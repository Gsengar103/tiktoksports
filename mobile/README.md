# Sports mobile app

Expo app for the sports short-video API in `backend/`.

```bash
cd mobile
cp .env.example .env
npm start
```

Set `EXPO_PUBLIC_API_URL` to the machine the phone can reach. `http://localhost:3000` works for the iOS simulator. An Android emulator should use `http://10.0.2.2:3000`. A physical phone needs your computer's LAN address.

Sign up with a date of birth of 13 or older, pick a sport, then use Feed, Search, Upload, and Profile. Upload picks an mp4 of 60 seconds or less, makes two JPEG thumbnails, and sends that file as both the preview and the progressive video. The two-rung HLS encode is not in this build.
