# ภาพต้นฉบับตัวละครสไตล์ใหม่ (ChatGPT)

ชีตเกม `client/public/assets/player.png` สร้างจากไฟล์ในโฟลเดอร์นี้:

```
python tools/walk_sheet.py --s design/char-src/walk_s_pose.png --sw design/char-src/walk_sw_pose2.png \
  --w design/char-src/walk_w_pose.png --nw design/char-src/walk_nw_pose2.png --n design/char-src/walk_n_pose.png
```

- `designbase.png`: ตัวฐานหัวโล้น 5 มุม (หน้า, 3/4 หน้า, ข้าง, หลัง, 3/4 หลัง) แนบให้ ChatGPT ทุกครั้ง
- `pose_s.png`, `pose_n.png`: แม่แบบท่าจาก Autosprite (`tools/pose_template.py`) ใช้ทำ S กับ N
- `walk_w_pose.png`: ทำจากท่าเดิน S ของเราเป็นแม่แบบจังหวะ · SW / NW: สั่งสลับขาด้วยซ้าย/ขวาของภาพ (มุมเฉียง ChatGPT สลับขาได้ไม่ค่อยดี ถ้าทำใหม่ให้ใช้แม่แบบจาก Autosprite)
- ทุกภาพ: 9 ช่องแถวเดียว (ยืน + เดิน 8) พื้น magenta เม็ด AI = 5 px
