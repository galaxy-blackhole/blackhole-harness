# author Bùi Trọng Hiếu
# email kevinbui210191@gmail.com
# create date 15/10/2026
# modify date 25/10/2026
# desc Chuan bi runtime PhoWhisper: kiem tra transformers/torch hoac tai model ve data-root.
import argparse  # 10/11/2026 (Lead): THIẾU import nay => `NameError: name 'argparse' is not defined`
# ngay dong dau => moi buoc "Chuan bi"/"Nhan dang" cua voice deu that bai (loi `undefined`).
import json
import os
import sys


def emit(payload):
    """In MOT dong JSON cuoi cung de phia Node parse."""
    print(json.dumps(payload, ensure_ascii=False))


def check_only():
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
    except Exception as error:  # pragma: no cover - phu thuoc may
        emit({"ok": False, "error": "Thieu Python package: " + str(error) + ". Chay: pip install torch transformers soundfile"})
        return 0
    emit({"ok": True, "torch": torch.__version__, "transformers": transformers.__version__})
    return 0


def download(model, data_root):
    try:
        from huggingface_hub import snapshot_download
    except Exception as error:  # pragma: no cover
        emit({"ok": False, "error": "Thieu huggingface_hub: " + str(error) + ". Chay: pip install huggingface_hub"})
        return 0
    target = os.path.join(data_root, "models")
    os.makedirs(target, exist_ok=True)
    try:
        path = snapshot_download(repo_id=model, local_dir=os.path.join(target, model.replace("/", "__")))
    except Exception as error:  # pragma: no cover
        emit({"ok": False, "error": "Tai model that bai: " + str(error)})
        return 0
    emit({"ok": True, "path": path})
    return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--model")
    parser.add_argument("--data-root")
    args = parser.parse_args()
    if args.check_only:
        return check_only()
    if not args.model or not args.data_root:
        emit({"ok": False, "error": "Thieu --model hoac --data-root"})
        return 0
    return download(args.model, args.data_root)


if __name__ == "__main__":
    sys.exit(main())
