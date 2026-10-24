"""
=============================================================================
PROJECT KAI: BIOAMP EEG INTEGRATION ADAPTER & MODEL TRAINING SERVICE
=============================================================================
This adapter exposes the BioAmp EEG data collection, feature telemetry, 
dataset inspection, and model training routines from the persistent EXG engine
to the modern web interface without altering the original backend logic.
=============================================================================
"""

import os
import time
import threading
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status
import pandas as pd
import numpy as np
import serial.tools.list_ports as lp

# Validated KAI Affective State Labels
VALID_EEG_LABELS = ["Relaxed", "High_Load", "Fatigued", "Agitated"]

# Threading locks to prevent concurrent hardware reads and training race conditions
eeg_sampling_lock = threading.Lock()
eeg_training_lock = threading.Lock()

# Global state tracker for asynchronous/job status
last_training_result: Dict[str, Any] = {
    "status": "idle",
    "timestamp": None,
    "message": "Model has not been trained in this runtime session.",
    "samplesUsed": 0,
    "classesCount": 0,
}

# The single authoritative EXG engine instance provided by the runtime
_exg_engine_ref = None
_latest_telemetry_ref = None
_dataset_path: Path = Path("eeg_training_data.csv")

router = APIRouter(prefix="/api/eeg", tags=["BioAmp EEG"])


def detect_arduino_port(preferred: str = "COM3") -> Optional[str]:
    """
    Scans system serial interfaces to locate connected Arduino / BioAmp hardware.
    Prioritizes official Arduino VID (0x2341), serial descriptions, or preferred port.
    """
    try:
        ports = list(lp.comports())
    except Exception as e:
        print(f"[EEG ADAPTER] Port enumeration warning: {e}")
        return preferred

    if not ports:
        return None

    # 1. Official Arduino VID 0x2341 (e.g. Arduino UNO R4 Minima / WiFi)
    for p in ports:
        if getattr(p, "vid", None) == 0x2341:
            print(f"[EEG ADAPTER] Found Arduino VID 0x2341 on {p.device} ({p.description})")
            return p.device

    # 2. Ports matching Arduino or USB Serial descriptions
    for p in ports:
        desc = (p.description or "").lower()
        if "arduino" in desc or "usb serial" in desc or "ch340" in desc or "ftdi" in desc:
            print(f"[EEG ADAPTER] Found serial device on {p.device} ({p.description})")
            return p.device

    # 3. Check if preferred port exists in system
    for p in ports:
        if p.device.upper() == preferred.upper():
            return p.device

    # 4. Fallback to first COM port if present
    return ports[0].device if ports else preferred


def try_connect_hardware(port: Optional[str] = None) -> bool:
    """Attempts to connect or reconnect the EXG engine to an available hardware port."""
    global _exg_engine_ref, _latest_telemetry_ref
    if _exg_engine_ref is None:
        return False

    target_port = port or detect_arduino_port(preferred=getattr(_exg_engine_ref, "port", "COM3")) or "COM3"

    try:
        # Safely close old serial handle if open
        if getattr(_exg_engine_ref, "ser", None) is not None:
            try:
                _exg_engine_ref.ser.close()
            except Exception:
                pass
            _exg_engine_ref.ser = None

        _exg_engine_ref.port = target_port
        _exg_engine_ref.connect()

        is_connected = bool(_exg_engine_ref.use_hardware)
        if _latest_telemetry_ref is not None:
            _latest_telemetry_ref["isHardwareConnected"] = is_connected

        print(f"[EEG ADAPTER] Hardware connect attempt on {target_port} -> Connected: {is_connected}")
        return is_connected
    except Exception as e:
        print(f"[EEG ADAPTER] Hardware connect attempt on {target_port} failed: {e}")
        return False


def init_eeg_adapter(exg_engine, latest_telemetry: Dict[str, Any], dataset_file: Path):
    """Initializes the adapter with the active runtime EXG engine reference."""
    global _exg_engine_ref, _latest_telemetry_ref, _dataset_path
    _exg_engine_ref = exg_engine
    _latest_telemetry_ref = latest_telemetry
    _dataset_path = Path(dataset_file)
    print(f"[EEG ADAPTER] Initialized with dataset at {_dataset_path.resolve()}")

    # If engine not connected yet, try auto-connecting to detected port
    if not getattr(_exg_engine_ref, "use_hardware", False):
        detected = detect_arduino_port(preferred=getattr(_exg_engine_ref, "port", "COM3"))
        if detected:
            try_connect_hardware(detected)


def _get_dataset_stats() -> Dict[str, Any]:
    """Inspects the existing training dataset CSV safely."""
    path = _dataset_path
    if not path.exists():
        return {
            "exists": False,
            "totalSamples": 0,
            "classCounts": {label: 0 for label in VALID_EEG_LABELS},
            "distinctClasses": 0,
            "isTrainable": False,
            "lastModified": None,
        }

    try:
        df = pd.read_csv(str(path))
        if df.empty or "label" not in df.columns:
            return {
                "exists": True,
                "totalSamples": 0,
                "classCounts": {label: 0 for label in VALID_EEG_LABELS},
                "distinctClasses": 0,
                "isTrainable": False,
                "lastModified": os.path.getmtime(str(path)),
            }

        counts = df["label"].value_counts().to_dict()
        normalized_counts = {label: int(counts.get(label, 0)) for label in VALID_EEG_LABELS}
        distinct_classes = int(len(counts))
        total_samples = int(len(df))

        return {
            "exists": True,
            "totalSamples": total_samples,
            "classCounts": normalized_counts,
            "distinctClasses": distinct_classes,
            "isTrainable": distinct_classes >= 2 and total_samples >= 2,
            "lastModified": os.path.getmtime(str(path)),
        }
    except Exception as e:
        return {
            "exists": True,
            "totalSamples": 0,
            "classCounts": {label: 0 for label in VALID_EEG_LABELS},
            "distinctClasses": 0,
            "isTrainable": False,
            "error": f"Failed to parse dataset CSV: {e}",
            "lastModified": None,
        }


# Request models
class RecordSamplePayload(BaseModel):
    label: str = Field(..., description="Subjective state label: Relaxed, High_Load, Fatigued, or Agitated")
    allow_simulation_test: bool = Field(False, description="Developer flag to allow simulation in unit testing")


# =============================================================================
# A. HARDWARE STATUS ENDPOINT
# =============================================================================
@router.get("/status")
def get_hardware_status():
    """
    Returns hardware connection status, data source designation,
    model state, and current dataset readiness.
    Auto-detects newly attached Arduino hardware dynamically.
    """
    if _exg_engine_ref is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="EXG Engine has not been initialized."
        )

    # Dynamic plug-and-play check: If not currently connected, check if an Arduino device is plugged in
    if not getattr(_exg_engine_ref, "use_hardware", False):
        detected = detect_arduino_port(preferred=getattr(_exg_engine_ref, "port", "COM3"))
        if detected:
            try_connect_hardware(detected)

    is_hardware = bool(_exg_engine_ref.use_hardware)
    is_trained = bool(getattr(_exg_engine_ref, "is_trained", False))
    sampling_rate = getattr(_exg_engine_ref, "sampling_rate", 512)
    port = getattr(_exg_engine_ref, "port", "COM3")
    baudrate = getattr(_exg_engine_ref, "baudrate", 115200)

    dataset_summary = _get_dataset_stats()

    error_msg = None
    if not is_hardware:
        error_msg = f"Arduino R4 not detected on {port} ({baudrate} baud). Running in simulated fallback mode."

    return {
        "connected": is_hardware,
        "dataSource": "hardware" if is_hardware else "simulation",
        "port": port if is_hardware else None,
        "baudrate": baudrate,
        "samplingRate": sampling_rate,
        "isRecording": eeg_sampling_lock.locked(),
        "isTraining": eeg_training_lock.locked(),
        "availableLabels": VALID_EEG_LABELS,
        "modelTrained": is_trained,
        "lastTrainingResult": last_training_result,
        "datasetSummary": dataset_summary,
        "error": error_msg,
    }


# =============================================================================
# A2. RECONNECT HARDWARE ENDPOINT
# =============================================================================
@router.post("/reconnect")
def reconnect_hardware():
    """
    Manually scans system ports and forces reconnection to BioAmp hardware.
    """
    if _exg_engine_ref is None:
        raise HTTPException(status_code=503, detail="EXG Engine unavailable")

    detected = detect_arduino_port(preferred=getattr(_exg_engine_ref, "port", "COM3"))
    if not detected:
        return {
            "success": False,
            "connected": False,
            "port": None,
            "message": "No serial COM ports or Arduino hardware detected on this machine."
        }

    success = try_connect_hardware(detected)
    return {
        "success": success,
        "connected": success,
        "port": detected if success else None,
        "message": f"Successfully connected to Arduino on {detected}" if success else f"Failed to open port {detected}"
    }


# =============================================================================
# B. LIVE TELEMETRY ENDPOINT
# =============================================================================
@router.get("/telemetry")
def get_live_telemetry():
    """
    Returns the latest available EEG feature telemetry readings (theta, alpha, beta, ratio, predicted state).
    """
    if _exg_engine_ref is None:
        raise HTTPException(status_code=503, detail="EXG Engine unavailable")

    is_hardware = bool(_exg_engine_ref.use_hardware)

    if _latest_telemetry_ref:
        return {
            "theta": round(float(_latest_telemetry_ref.get("theta", 0.0)), 2),
            "alpha": round(float(_latest_telemetry_ref.get("alpha", 0.0)), 2),
            "beta": round(float(_latest_telemetry_ref.get("beta", 0.0)), 2),
            "arousalRatio": round(float(_latest_telemetry_ref.get("arousalRatio", 0.0)), 3),
            "predictedState": str(_latest_telemetry_ref.get("state", "Calm")),
            "timestamp": time.strftime("%H:%M:%S"),
            "isHardwareConnected": is_hardware,
            "dataSource": "hardware" if is_hardware else "simulation",
            "samplingRate": getattr(_exg_engine_ref, "sampling_rate", 512),
        }

    # Fallback to direct read if buffer not yet populated
    feats = _exg_engine_ref.read_features(duration_sec=0.2)
    state = _exg_engine_ref.predict()
    return {
        "theta": round(float(feats[0]), 2),
        "alpha": round(float(feats[1]), 2),
        "beta": round(float(feats[2]), 2),
        "arousalRatio": round(float(feats[3]), 3),
        "predictedState": str(state),
        "timestamp": time.strftime("%H:%M:%S"),
        "isHardwareConnected": is_hardware,
        "dataSource": "hardware" if is_hardware else "simulation",
        "samplingRate": getattr(_exg_engine_ref, "sampling_rate", 512),
    }


# =============================================================================
# C. RECORD LABELED SAMPLE ENDPOINT
# =============================================================================
@router.post("/samples")
async def record_labeled_sample(payload: RecordSamplePayload):
    """
    Reads live EEG features from the hardware engine, associates them with the selected label,
    and appends them to the training dataset CSV.
    Strict validation:
    - Rejects invalid labels.
    - Rejects recording when only simulated data is available (unless explicit allow_simulation_test flag).
    - Prevents overlapping recordings with thread-safe lock.
    """
    if _exg_engine_ref is None:
        raise HTTPException(status_code=503, detail="EXG Engine unavailable")

    # 1. Label Validation
    # Map any frontend variants like "High Load" to "High_Load"
    label = payload.label.strip().replace(" ", "_")
    if label not in VALID_EEG_LABELS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid label '{payload.label}'. Must be one of {VALID_EEG_LABELS}."
        )

    # 2. Hardware Verification & Data Integrity Gate
    is_hardware = bool(_exg_engine_ref.use_hardware)
    if not is_hardware and not payload.allow_simulation_test:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Recording failed: Physical BioAmp EEG hardware is not connected. "
                "Simulated samples are rejected to maintain model training data integrity."
            )
        )

    # 3. Concurrency Lock
    if not eeg_sampling_lock.acquire(blocking=False):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A sample recording is already in progress. Please wait for it to complete."
        )

    try:
        # Offload 1.5s sampling window away from the event loop
        def _do_record():
            return _exg_engine_ref.save_sample_to_csv(label=label)

        feats = await asyncio.to_thread(_do_record)
        dataset_summary = _get_dataset_stats()

        return {
            "success": True,
            "label": label,
            "features": {
                "theta": round(float(feats[0]), 3),
                "alpha": round(float(feats[1]), 3),
                "beta": round(float(feats[2]), 3),
                "ratio": round(float(feats[3]), 3),
            },
            "dataSource": "hardware" if is_hardware else "simulation_test",
            "message": f"Successfully captured EEG sample and appended to dataset under '{label}'.",
            "datasetSummary": dataset_summary,
            "timestamp": time.strftime("%H:%M:%S"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record sample: {e}")
    finally:
        eeg_sampling_lock.release()


# =============================================================================
# D. DATASET SUMMARY ENDPOINT
# =============================================================================
@router.get("/dataset")
def get_dataset_summary():
    """Returns historical sample counts per label and training readiness."""
    stats = _get_dataset_stats()
    return stats


# =============================================================================
# E. MODEL TRAINING ENDPOINT
# =============================================================================
@router.post("/train")
async def train_model():
    """
    Invokes the backend PersistentEXGEngine.train_from_dataset() to retrain
    the RandomForestClassifier on historical CSV samples and serialize to eeg_model.pkl.
    """
    global last_training_result

    if _exg_engine_ref is None:
        raise HTTPException(status_code=503, detail="EXG Engine unavailable")

    # 1. Dataset Sufficiency Validation
    stats = _get_dataset_stats()
    if not stats["exists"] or stats["totalSamples"] < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient dataset: Please record at least 2 samples before training."
        )

    if stats["distinctClasses"] < 2:
        missing_count = 2 - stats["distinctClasses"]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Multi-class classification requires at least 2 distinct emotion classes. "
                f"Current dataset contains {stats['distinctClasses']} class. "
                f"Record samples under another label (e.g., Relaxed, High_Load, Fatigued, or Agitated)."
            )
        )

    # 2. Concurrency Lock
    if not eeg_training_lock.acquire(blocking=False):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Model training is already in progress. Please wait for completion."
        )

    try:
        last_training_result["status"] = "training"
        last_training_result["timestamp"] = time.strftime("%H:%M:%S")

        def _do_train():
            return _exg_engine_ref.train_from_dataset()

        success, msg = await asyncio.to_thread(_do_train)

        last_training_result["status"] = "completed" if success else "failed"
        last_training_result["message"] = msg
        last_training_result["samplesUsed"] = stats["totalSamples"]
        last_training_result["classesCount"] = stats["distinctClasses"]
        last_training_result["timestamp"] = time.strftime("%H:%M:%S")

        if not success:
            raise HTTPException(status_code=400, detail=msg)

        return {
            "success": True,
            "message": msg,
            "modelTrained": bool(getattr(_exg_engine_ref, "is_trained", False)),
            "totalSamples": stats["totalSamples"],
            "distinctClasses": stats["distinctClasses"],
            "classCounts": stats["classCounts"],
            "timestamp": time.strftime("%H:%M:%S"),
        }
    except HTTPException:
        raise
    except Exception as e:
        last_training_result["status"] = "failed"
        last_training_result["message"] = str(e)
        raise HTTPException(status_code=500, detail=f"Training failure: {e}")
    finally:
        eeg_training_lock.release()
