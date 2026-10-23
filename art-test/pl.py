"""PixelLab test client: python pl.py <endpoint> <request.json> <out_prefix>
Reads the API key from env PIXELLAB_KEY. Posts, polls background job, saves every base64 image found."""
import base64, json, os, sys, time, urllib.request, urllib.error

API = "https://api.pixellab.ai/v2"
KEY = os.environ["PIXELLAB_KEY"]


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method,
                                 data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:2000]}")


def b64img(path):
    return {"type": "base64", "base64": base64.b64encode(open(path, "rb").read()).decode()}


def save_images(obj, prefix, key="img"):
    n = 0
    if isinstance(obj, dict):
        if obj.get("type") == "base64" and "base64" in obj:
            data = obj["base64"].split(",")[-1]
            fn = f"{prefix}_{key}.png"
            open(fn, "wb").write(base64.b64decode(data))
            print("saved", fn)
            return 1
        for k, v in obj.items():
            if isinstance(v, str) and len(v) > 200 and v.startswith(("iVBOR", "data:image")):
                fn = f"{prefix}_{k}.png"
                open(fn, "wb").write(base64.b64decode(v.split(",")[-1]))
                print("saved", fn)
                n += 1
                continue
            n += save_images(v, prefix, f"{key}_{k}" if key != "img" else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            n += save_images(v, prefix, f"{key}_{i}")
    return n


def strip(obj):
    if isinstance(obj, dict):
        return {k: ("<b64>" if k == "base64" or (isinstance(v, str) and len(v) > 200) else strip(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [strip(v) for v in obj]
    return obj


if __name__ == "__main__":
    endpoint, reqfile, prefix = sys.argv[1:4]
    body = json.load(open(reqfile, encoding="utf-8"))
    for k, v in list(body.items()):  # "@file.png" -> base64 image
        if isinstance(v, str) and v.startswith("@"):
            body[k] = b64img(v[1:])
    r = call("POST", endpoint, body)
    print(json.dumps(strip(r))[:1500])
    job = r.get("background_job_id") or (r.get("data") or {}).get("background_job_id")
    while job:
        time.sleep(8)
        j = call("GET", f"/background-jobs/{job}")
        st = j.get("status") or (j.get("data") or {}).get("status")
        print("status", st)
        if st not in ("pending", "processing", "queued", "running"):
            r = j
            break
    json.dump(strip(r), open(prefix + "_resp.json", "w"), indent=1)
    if not save_images(r, prefix):
        print(json.dumps(strip(r))[:3000])
