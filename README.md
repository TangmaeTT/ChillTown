# Chill Town

เกมออนไลน์บนเว็บไว้เดินเล่น แต่งตัว และคุยกัน แนว Zheza ฉากเป็นกรุงเทพแบบดัดแปลง ใจกลางคือย่านสยาม · Phaser 4 + TypeScript · isometric pixel art

- โน้ตโปรเจกต์ (เริ่มอ่านที่นี่): [`PROJECT_NOTES.md`](PROJECT_NOTES.md)
- Game design: [`design/GDD.md`](design/GDD.md)
- ผังใจกลางสยาม: [`design/siam-layout.md`](design/siam-layout.md) · ![ผัง](design/siam-map.png)

## โครงสร้าง

```
shared/   ใช้ร่วมกันทั้งสองฝั่ง: ข้อมูลห้อง (rooms.ts) · collision · พิกัด iso · นาฬิกาเกม · ผังรถไฟฟ้า
client/   หน้าบ้าน (Phaser 4 + Vite)
  src/model/       สถานะและกติกา ไม่มี Phaser (โลก/เวลา, ห้อง, ผู้เล่น)
  src/view/        วาดอย่างเดียว (ห้อง, ผู้เล่น, แสงตามเวลา, HUD, art/)
  src/controller/  รับ input + วนลูปเกม + เปลี่ยนห้อง (GameController, InputController, actions)
server/   หลังบ้าน (Node 24 รัน TypeScript ตรง ไม่ต้อง build)
  src/models/ · src/views/ · src/controllers/ · routes.ts
```
กติกา: view ไม่แก้ model เอง (เรียกผ่าน controller) · model ไม่ import Phaser · โค้ดใน `shared/` ห้ามใช้ syntax เฉพาะ TS ที่ลบทิ้งไม่ได้ (enum, parameter properties) เพราะ Node รันตรง

## รัน

```
cd client && npm install && npm run dev-nolog     # เกม: http://localhost:8080
cd server && npm install && npm start             # API: http://localhost:2567/api/time
```
ทดสอบ: `?room=soi` กระโดดไปห้อง · `?zoom=0.75` · `?time=18:30` เริ่มที่เวลานั้น · `?rain=0` ไม่มีฝน
API: `/api/health` · `/api/time` · `/api/rooms` · `/api/rooms/plaza/walkable?i=16&j=3`

## Map editor

เปิด server ก่อน (`cd server && npm run dev`) แล้วเข้า http://localhost:8080/?edit=1&room=plaza
- เครื่องมือ: 1 เลือก/ย้าย · 2 วางของ · 3 ระบายพื้น · 4 ไฟถนน · 5 ทางออก · 6 จุดเกิด · 7 ทางคนเดิน
- Ctrl+Z / Ctrl+Y ย้อน/ทำซ้ำ · Ctrl+S บันทึก · Del ลบ · R หมุน · WASD หรือลากเมาส์ขวา เลื่อนกล้อง · ล้อเมาส์ ซูม
- บันทึกลง `shared/rooms/<ห้อง>.json` (ผ่าน server ซึ่งตรวจห้องก่อน: จุดเกิด ทางออก หน้าร้าน ของทับกัน) แล้วเกมโหลดห้องใหม่เอง
- บันทึกได้เฉพาะจากเครื่องนี้ และปิดเองเมื่อ `NODE_ENV=production`
- ของที่วางได้อยู่ใน `client/src/model/editorCatalog.ts`

## Git

ทำงานบน feature branch (`feature/...`) แล้วเปิด Pull Request เข้า `main` ไม่ commit ตรงเข้า `main`

## เครื่องมือ

- `tools/pixelfix.py`: แปลงภาพ AI เป็น pixel art จริง (`--help`)
- `tools/render_map.py`: วาดผังมุมบนจาก `shared/rooms.ts`
