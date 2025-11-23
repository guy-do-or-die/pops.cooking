# iPhone Compatibility Fixes

Based on recommendations from `local/verification_poc.md`, the following mobile/iPhone compatibility improvements have been implemented:

## ✅ Already Implemented

1. **Video Element Attributes** (`web/src/components/capture/Capture.tsx`)
   - ✅ `autoPlay` - Required for iOS
   - ✅ `playsInline` - Critical for iOS Safari to prevent fullscreen
   - ✅ `muted` - Required for autoplay on iOS
   - ✅ `canvas.captureStream()` - Recording combined video + overlay

## 🔧 New Fixes Applied

### Frontend (web/)

1. **Flash Duration** (`src/components/capture/Capture.tsx`)
   - **Before**: 50ms flash window
   - **After**: 200ms flash window
   - **Why**: Mobile video compression artifacts - short flashes get lost
   - **Change**: `Math.abs(elapsed - timing) < 200`

2. **Browser Targets** (`package.json`)
   - **Added**: `browserslist` targeting iOS 12+, Safari 12+
   - **Why**: Fixes React rendering issues on older Safari engines
   - **Ensures**: Proper transpilation for iPhone compatibility

### Backend (verifier/)

3. **Auto-Exposure Filter** (`video.py`)
   - **Before**: Ignore first 100ms
   - **After**: Ignore first 500ms
   - **Why**: iPhone cameras adjust brightness on startup, causing false flash detections
   - **Change**: `if t > 0.5` (was `t > 0.1`)

4. **Mobile Tolerance** (`server.py`)
   - **Before**: 600ms tolerance
   - **After**: 700ms tolerance
   - **Why**: Mobile audio/video desync (especially on iPhone)
   - **Range**: Within recommended 600-800ms from spec

## Testing Checklist for iPhone

### Required Setup
- [ ] **HTTPS Only**: Camera access requires HTTPS
  - Use ngrok/ROFL deployment (localhost won't work)
  - Vercel deployment has HTTPS by default

### Test Flow
1. [ ] Open app on iPhone Safari
2. [ ] Grant camera permissions (should work with playsinline)
3. [ ] Create PoP → Camera should activate
4. [ ] Snap PoP → Should see white flashes during 5s recording
5. [ ] Verify → Should pass with new tolerances
6. [ ] Seal → Transaction should succeed

### Common iPhone Issues (Now Fixed)

| Issue | Symptom | Fix Applied |
|-------|---------|-------------|
| Camera not starting | Black screen | ✅ `playsinline muted autoPlay` |
| Video goes fullscreen | Can't see UI | ✅ `playsinline` attribute |
| Flashes not detected | Verification fails | ✅ 200ms flash duration |
| False flash at start | Wrong verification | ✅ Ignore first 500ms |
| Audio/video out of sync | Timing mismatch | ✅ 700ms tolerance |
| React not rendering | Blank page | ✅ `browserslist: iOS >= 12` |

## Deployment Notes

- **Vercel**: Already has HTTPS, just redeploy
- **ROFL TEE**: Already has HTTPS proxy (p8000.*.rofl.app)
- **Local Dev**: Use `ngrok http 5173` for iPhone testing

## Debug Tips

If verification still fails on iPhone:
1. Check browser console for camera errors
2. Verify HTTPS (lock icon in Safari)
3. Check network tab - video upload should succeed
4. Look at verifier logs for detection details
5. Try increasing tolerance_s to 0.8 if needed

## Performance Notes

- Flash duration: 200ms × 3-5 flashes = 600-1000ms of visible strobes
- Total recording: 5 seconds
- Tolerance window: ±700ms for timing matches
- Startup ignore: First 500ms filtered out
