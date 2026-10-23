# Chill Town

เกมออนไลน์บนเว็บไว้เดินเล่น แต่งตัว และคุยกัน แนว Zheza ฉากเป็นกรุงเทพแบบดัดแปลง ใจกลางคือย่านสยาม · Phaser 4 + TypeScript · isometric pixel art

- โน้ตโปรเจกต์ (เริ่มอ่านที่นี่): [`PROJECT_NOTES.md`](PROJECT_NOTES.md)
- ผังใจกลางสยาม: [`design/siam-layout.md`](design/siam-layout.md) · ![ผัง](design/siam-map.png)

## รันเกม

```
cd client
npm install
npm run dev-nolog
```
เปิด http://localhost:8080 (มือถือใน Wi-Fi เดียวกันใช้ที่อยู่ Network ที่ Vite แสดง) · `?room=soi` กระโดดไปห้อง · `?zoom=0.75` ซูมเริ่มต้น

## เครื่องมือ

- `tools/pixelfix.py`: แปลงภาพ AI เป็น pixel art จริง (`--help`)
- `tools/render_map.py`: วาดผังมุมบนจาก `client/src/game/rooms.ts`
