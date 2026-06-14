Directory Structure Tree

Hackathon_Data_Pack/
│
├── README.md                  <-- 📜 กติกา โจทย์ และเกณฑ์การให้คะแนน (สำคัญมาก)
├── DATA_DICTIONARY.md         <-- 📖 คู่มืออธิบายความหมายของตัวแปร (Status code ต่างๆ)
│
└── data/                      <-- 🗂️ ชุดข้อมูล JSON ทั้งหมด
    ├── users.json             <-- (ข้อมูลกลาง) รายชื่อผู้ใช้งาน ใช้เชื่อมกับทุกระบบ
    │
    ├── ecommerce/             <-- 🛒 ระบบร้านค้า
    │   ├── products.json
    │   └── orders.json
    │
    ├── hotel/                 <-- 🏨 ระบบจองโรงแรม
    │   ├── hotels.json
    │   └── bookings.json
    │
    ├── travel/                <-- ✈️ ระบบจองตั๋วเดินทาง
    │   ├── flights.json
    │   └── tickets.json
    │
    ├── finance/               <-- 💰 ระบบการเงิน
    │   └── transactions.json
    │
    ├── food/                  <-- 🍔 ระบบสั่งอาหาร
    │   ├── restaurants.json
    │   └── orders.json
    │
    ├── healthcare/            <-- 🏥 ระบบนัดพบแพทย์
    │   ├── doctors.json
    │   └── appointments.json
    │
    ├── education/             <-- 🎓 ระบบเรียนออนไลน์
    │   ├──courses.json
    │   └── enrollments.json
    │
    ├── event/                 <-- 🎟️ ระบบอีเวนต์
    │   ├── events.json
    │   └── tickets.json
    │
    ├── productivity/          <-- ✅ ระบบจัดการงาน
    │   ├──projects.json
    │   ├──tasks.json
    │
    └── common/           <-- ⭐ common data
        ├── reviews.json
        ├── locations.json
        ├── notifications.json
        └── chats.json
    