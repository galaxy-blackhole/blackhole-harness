# author Bùi Trọng Hiếu
# email kevinbui210191@gmail.com
# create date 15/10/2026
# modify date 25/10/2026
# desc Nhan dang MOT tep WAV bang PhoWhisper (transformers) va in JSON {ok, text}.
import argparse  # 10/11/2026 (Lead): THIẾU import nay => `NameError: name 'argparse' is not defined`
# ngay dong dau => moi buoc "Chuan bi"/"Nhan dang" cua voice deu that bai (loi `undefined`).
import json
import os
import sys


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--data-root", required=True)
    parser.add_argument("--audio", required=True)
    parser.add_argument("--language", default="auto")
    parser.add_argument("--device", default="cpu")
    args = parser.parse_args()
    local = os.path.join(args.data_root, "models", args.model.replace("/", "__"))
    source = local if os.path.isdir(local) else args.model
    try:
        import torch  # noqa: F401
        from transformers import pipeline
    except Exception as error:  # pragma: no cover
        emit({"ok": False, "error": "Thieu Python package: " + str(error) + ". Chay: pip install torch transformers soundfile"})
        return 0
    # 10/11/2026 (Lead): KHONG dua DUONG DAN tep vao pipeline — transformers can ffmpeg de giai ma ten tep,
    # ma may nguoi dung khong co ffmpeg => "ffmpeg was not found but is required to load audio files from filename".
    # Ta da co soundfile trong venv: doc WAV thanh mang float32 16 kHz roi dua MANG vao pipeline (khong can ffmpeg).
    try:
        import soundfile as sf
        import numpy as np
        samples, rate = sf.read(args.audio, dtype="float32", always_2d=False)
        if getattr(samples, "ndim", 1) > 1:
            samples = samples.mean(axis=1)
        if rate != 16000 and len(samples) > 0:
            # Noi suy tuyen tinh ve 16 kHz — Whisper chi nhan 16 kHz; khong can scipy/librosa.
            so_mau = int(round(len(samples) * 16000 / float(rate)))
            samples = np.interp(
                np.linspace(0.0, len(samples) - 1, so_mau, dtype="float64"),
                np.arange(len(samples), dtype="float64"),
                samples.astype("float64"),
            ).astype("float32")
    except Exception as error:  # pragma: no cover
        emit({"ok": False, "error": "Doc am thanh that bai: " + str(error)})
        return 0
    try:
        asr = pipeline("automatic-speech-recognition", model=source, device=-1 if args.device == "cpu" else 0)
        language = None if args.language in ("auto", "") else args.language
        options = {"language": language} if language is not None else {}
        result = asr(samples, generate_kwargs=options)
        text = result.get("text", "") if isinstance(result, dict) else str(result)
        emit({"ok": True, "text": text.strip()})
    except Exception as error:  # pragma: no cover
        emit({"ok": False, "error": "Nhan dang that bai: " + str(error)})
    return 0


if __name__ == "__main__":
    sys.exit(main())
