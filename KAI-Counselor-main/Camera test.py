
import cv2

for index in (0, 1):
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)

    print(f"\nCamera index: {index}")
    print("Opened:", cap.isOpened())

    if not cap.isOpened():
        cap.release()
        continue

    try:
        for _ in range(10):
            cap.read()  # Allow the camera to settle.

        while True:
            ok, frame = cap.read()

            if not ok or frame is None:
                print("Frame capture failed.")
                break

            print(
                f"\rShape: {frame.shape} | "
                f"Mean: {frame.mean():.2f} | "
                f"Std: {frame.std():.2f}",
                end="",
                flush=True,
            )

            cv2.imshow(f"Raw Camera Test - Index {index}", frame)

            if cv2.waitKey(1) & 0xFF == 27:
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()
