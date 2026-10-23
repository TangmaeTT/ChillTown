# รายการ asset สำหรับ ChatGPT · ลานสถานีสยาม (เฟส 1)

> 23 ต.ค. 2026 · ใช้คู่กับ `design/siam-layout.md` และ `PROJECT_NOTES.md` §3 (มาตรฐานภาพ)
> ทุกภาพจาก ChatGPT จะผ่าน `tools/pixelfix.py` แล้วค่อยเข้าเกม ไม่ต้องให้ ChatGPT ทำให้เป๊ะระดับพิกเซล

## 0. สิ่งที่ ChatGPT ไม่ต้องทำ

| อะไร | ทำด้วยอะไร | ทำไม |
|---|---|---|
| ราง เสา ตัวสถานี บันไดสถานี | โค้ด (มีแล้ว) | ใหญ่เกินภาพ 1536 px ที่ ChatGPT ทำได้ และต้องต่อกันยาวลงกริดเป๊ะ |
| พื้น (ทางเท้า ถนน ทางม้าลาย ลาน) | โค้ด (มีแล้ว) | tile ต้องต่อกันไม่เห็นรอย AI ทำไม่ได้ |
| ตัวละคร / คนเดินถนน | PixelLab | ต้องได้ 8 ทิศพร้อมท่าเดินที่หน้าตาตรงกันทุกเฟรม |

## 1. กติกาภาพ (แนบทุกครั้ง)

1. **มุมกล้อง isometric 2:1** (มุมแบบ Habbo/Zheza) เห็นด้านหน้าของวัตถุสองด้าน: **ซ้ายล่าง** กับ **ขวาล่าง** ด้านที่หันไปข้างหลังจะมองไม่เห็นเลย หน้าร้าน ประตู และป้ายต้องอยู่สองด้านนี้เท่านั้น
2. **แสงกลางวันแบบนุ่ม มาจากซ้ายบน** ด้านซ้ายสว่าง ด้านขวามืดกว่า **ห้ามอบแสงกลางคืน แสงเย็น หรือไฟสีส้มไว้ในภาพหลัก** เกมจะย้อมสีตามเวลาเอง
3. **ไม่มีเงาตกบนพื้น และไม่มีพื้นรอบวัตถุ** เอาแค่ตัววัตถุ
4. **พื้นหลังสีม่วงชมพูล้วน `#FF00FF`** ไม่มีไล่สี ไม่มีลาย
5. **ไม่มีตัวหนังสือ โลโก้ หรือแบรนด์จริง** (BTS, 7-Eleven, Grab ฯลฯ) ป้ายให้เป็นลวดลายหรือตัวอักษรมั่ว ๆ ที่อ่านไม่ออก
6. **โทนสี:** หม่น เขียวมอส น้ำเงินเทา ไม่ใช้นีออนหรือชมพูม่วงจัด (ยกเว้นแท็กซี่ชมพูที่เป็นสีจริงของมัน แต่ให้หม่นลงหน่อย)
7. **pixel art จริง** เม็ดใหญ่ชัด ขอบคม สีจำนวนน้อย ไม่เบลอ ไม่ไล่สีนุ่ม ๆ แบบภาพวาด
8. **แนบ `client/public/assets/noodle_shop.png` เป็น style reference ทุกครั้ง** แล้วบอกว่า "match this pixel style, but daylight"

## 2. ภาพกลางคืน (ทำเฉพาะชิ้นที่มีช่อง "ไฟ")

หลังได้ภาพกลางวันแล้ว ให้ใช้ **edit ภาพเดิมใน ChatGPT** แล้วสั่ง:

> Same image, same composition and pixels, only change: it's night and the lights are on (windows, lamps, signs, headlights glow warm). Do not move or redraw anything else. Keep the magenta background.

ผมจะเอาภาพกลางวันกับกลางคืนมาเทียบกัน แล้วดึงเฉพาะส่วนที่สว่างขึ้นออกมาเป็นชั้นไฟ ถ้าภาพกลางคืนขยับตำแหน่งไปเยอะ ผมจะแก้ด้วยมือ

## 3. ขนาดและสเกล

- ตัวละครสูงประมาณ **51 px** ชั้นอาคาร 1 ชั้นสูงประมาณ **100 px** ของอย่างอื่นย่อส่วนแบบเกม ไม่ใช่สเกลจริง
- **"ขนาดในเกม"** คือขนาดภาพหลังแปลงแล้ว บอก ChatGPT เป็นแนวทางได้ เช่น "about 128×120 pixels of pixel art, scaled up" ถ้าออกมาไม่ตรง ผมย่อหรือขยายให้ตรงด้วย pixelfix ได้
- **Canvas** คือขนาดภาพที่ให้ ChatGPT สร้าง: `1024×1024` = สี่เหลี่ยมจัตุรัส, `1024×1536` = แนวตั้ง, `1536×1024` = แนวนอน
- ตัวเลขช่อง (tile) ไว้ให้ผมใช้วางของในเกม คุณไม่ต้องบอก ChatGPT

## 4. รายการ: ลานสถานีสยาม

### ยานพาหนะ (วิ่งได้ ต้องมีภาพสองหัว)
ยานพาหนะทุกคันวาง**ตามแนวถนน** คือแนวทแยงจากซ้ายบนไปขวาล่าง แต่ละคันต้องมี 2 ภาพ:
- **`_front`** หน้ารถหันไป**ขวาล่าง** (รถวิ่งเข้าหากล้อง)
- **`_rear`** ท้ายรถหันไปขวาล่าง (รถวิ่งออกไปทางซ้ายบน)

| ID | ชิ้น | ช่อง (i×j) | ขนาดในเกม | Canvas | ไฟ | คำอธิบายให้ ChatGPT |
|---|---|---|---|---|---|---|
| P01 | ตู้รถไฟฟ้า หัวขบวน | 3×1 | 128×120 | 1024×1024 | ✓ | elevated metro train car, front cab with windshield and headlights facing bottom-right, silver body with a muted teal stripe, sliding doors, windows |
| P02 | ตู้รถไฟฟ้า กลางขบวน | 3×1 | 128×120 | 1024×1024 | ✓ | same metro car, middle car, no cab, gangway connectors at both ends |
| P03 | ตู้รถไฟฟ้า ท้ายขบวน | 3×1 | 128×120 | 1024×1024 | ✓ | same metro car, rear cab facing bottom-right with red tail lights |
| P04 | แท็กซี่สีชมพู `_front` / `_rear` | 1.8×0.8 | 83×74 | 1024×1024 | ✓ | Bangkok taxi, muted pink sedan, small roof sign (no text) |
| P05 | แท็กซี่เขียว-เหลือง `_front` / `_rear` | 1.8×0.8 | 83×74 | 1024×1024 | ✓ | Bangkok taxi, green lower body, yellow upper body/roof |
| P06 | รถเก๋งขาว `_front` / `_rear` | 1.8×0.8 | 83×74 | 1024×1024 | ✓ | ordinary white sedan, a bit dusty |
| P07 | รถกระบะเทา `_front` / `_rear` | 2.0×0.8 | 90×77 | 1024×1024 | ✓ | grey pickup truck, open bed with a tarp |
| P08 | ตุ๊กตุ๊ก `_front` / `_rear` | 1.2×0.7 | 61×66 | 1024×1024 | ✓ | Thai tuk-tuk, three wheels, blue body, dark canopy roof |
| P09 | รถเมล์ `_front` / `_rear` | 3.6×1.0 | 147×133 | 1024×1024 | ✓ | Bangkok city bus, faded blue and cream, big windows, no route number |

### ของในลาน

| ID | ชิ้น | ช่อง (i×j) | ขนาดในเกม | Canvas | ไฟ | คำอธิบายให้ ChatGPT |
|---|---|---|---|---|---|---|
| P10 | ต้นจามจุรีใหญ่ | 1×1 (พุ่มกว้างกว่าฐาน) | 110×150 | 1024×1536 | | big rain tree, wide umbrella canopy, short thick trunk, small round planter at the base |
| P11 | ต้นไม้เล็กในกระถาง | 1×1 | 64×110 | 1024×1536 | | small street tree in a square concrete planter |
| P12 | ม้านั่ง (ยาวตามแนวซ้ายบน→ขวาล่าง) | 2×0.6 | 83×58 | 1024×1024 | | public bench, wooden slats, metal legs, long side running top-left to bottom-right |
| P13 | ม้านั่ง (ยาวตามแนวขวาบน→ซ้ายล่าง) | 0.6×2 | 83×58 | 1024×1024 | | same bench rotated, long side running top-right to bottom-left |
| P14 | เสานาฬิกา จุดนัดเจอ | 1×1 | 64×162 | 1024×1536 | ✓ | tall old-fashioned street clock on a dark green post, two clock faces visible (bottom-left and bottom-right sides), small base |
| P15 | ซุ้มขายน้ำ/ขนม | 4×3 | 224×192 | 1536×1024 | ✓ | small street kiosk selling drinks and snacks, counter opening on the bottom-left side, striped awning, shelves with bottles, no brand |
| P16 | ซุ้มดอกไม้ | 5×3 | 256×208 | 1536×1024 | ✓ | flower stall kiosk, buckets of flowers in front on the bottom-left side, green awning |
| P17 | เสาไฟถนน | 0.5×0.5 | 32×126 | 1024×1536 | ✓ | Bangkok street lamp, single arm, grey metal pole |
| P18 | ป้ายรถเมล์ (มีหลังคา) | 3×1 | 128×140 | 1024×1024 | ✓ | bus stop shelter, roof, bench, blank advertising light box on the bottom-left side |
| P19 | วินมอเตอร์ไซค์ | 2×1 | 96×98 | 1024×1024 | | motorbike taxi stand: small roofed sign post and three parked scooters, no people |
| P20 | ถังขยะ | 0.5×0.5 | 32×42 | 1024×1024 | | public trash bin, green, lid |
| P21 | ตู้กดน้ำ | 0.6×0.6 | 38×69 | 1024×1536 | ✓ | drink vending machine, front on the bottom-left side, rows of cans, no brand |
| P22 | ป้ายโฆษณาบนสถานี | 6×0.1 (แผ่นแบน) | 195×132 | 1536×1024 | ✓ | long flat billboard panel seen at isometric angle, facing bottom-left, abstract colourful poster (no text), metal frame |

### แก้ของเดิม

| ID | ชิ้น | ขนาดในเกม | Canvas | วิธี |
|---|---|---|---|---|
| P23 | ร้านก๋วยเตี๋ยว **เวอร์ชันกลางวัน** | 227×299 (เท่าเดิม) | 1024×1536 | แนบ `noodle_shop.png` แล้วสั่ง edit: "same building, same pixels and layout, but daytime: daylight from the top-left, interior lights off, sky light on the walls". ภาพเดิมใช้เป็นเวอร์ชันกลางคืน |

**รวมเฟส 1:** 23 รายการ เป็นภาพกลางวันประมาณ 33 ภาพ (ยานพาหนะคันละ 2 ภาพ) และภาพกลางคืนประมาณ 25 ภาพ

## 5. ลำดับที่แนะนำ

1. **P23 ร้านก๋วยเตี๋ยวกลางวัน** ใช้ทดสอบว่า ChatGPT ทำกลางวันกับกลางคืนให้ตรงกันได้ไหม ถ้าผ่าน วิธีนี้ใช้กับทุกชิ้น
2. **P14, P10, P12, P15, P16** เป็นของในลานที่เห็นตั้งแต่เปิดเกม
3. **P04–P09** รถ
4. **P01–P03** รถไฟฟ้า
5. **P17–P22** ของเสริมบรรยากาศ

## 6. ส่งไฟล์

- วางที่ `ChillTown/art-in/` (ผมจะสร้างโฟลเดอร์และไม่ใส่ใน git จนกว่าจะแปลงเสร็จ)
- ตั้งชื่อตาม ID: `P04_taxi_pink_front_day.png` · `P04_taxi_pink_front_night.png` · `P23_noodle_shop_day.png`
- ไม่ต้องตัดขอบหรือแก้อะไร ผมแปลงด้วย pixelfix และวางลงเกมเอง

## 7. Prompt แม่แบบ (copy ไปใช้ได้เลย)

```
Isometric pixel art game asset, strict 2:1 isometric angle (like Habbo Hotel),
showing only the two front faces (bottom-left and bottom-right).
Subject: <คำอธิบายจากตาราง>.
Chunky low-resolution pixel art, about <ขนาดในเกม> pixels, scaled up with hard
square pixels, limited muted palette (moss green, blue-grey, warm greys),
crisp outlines, no anti-aliasing, no soft painterly shading.
Soft daylight from the top-left: left faces lit, right faces in shade.
No night lighting, no glow, no cast shadow, no ground under the object.
Plain solid magenta #FF00FF background. No text, no logos, no real brands.
Match the pixel style of the attached reference, but in daylight.
```

## 8. เฟสถัดไป (ยังไม่ต้องทำ)

**ซอยสแควร์:** ตึกแถว (ทำเป็นโมดูลห้องละ 2×4 ช่อง, ขนาดในเกม 192×316, canvas 1024×1536) · ร้านมุม 4×4 (256×328) · ร้านเสื้อผ้า คาเฟ่ ร้านเกม/ร้านเน็ต ร้านสะดวกซื้อ (ไม่มีแบรนด์) โรงหนังเก่า (แบ่ง 2 โมดูล) ร้านตัดผม ร้านกิ๊ฟช็อป ร้านหนังสือ โรงเรียนกวดวิชา

> **ต้องแก้ผังก่อน:** ตามกติกาข้อ 1 หน้าร้านต้องหันมาทางซ้ายล่างหรือขวาล่าง แต่ผังซอยตอนนี้มีร้านหลายหลังที่หน้าร้านหันเข้าหาซอยในทิศที่กล้องมองไม่เห็น ผมจะจัดผังใหม่ก่อนสั่งภาพชุดนี้

**ลานหน้าห้าง และท่าเรือคลอง:** ทำหลังจากซอยเสร็จ (ห้างใหญ่ต้องแบ่งเป็นโมดูลด้านหน้าห้าง)
