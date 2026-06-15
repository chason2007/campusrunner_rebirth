-- ============================================================
-- Campus Runner — seed catalog
-- Run after migrations. Prices in paise (₹1 = 100 paise).
-- ============================================================

insert into vendors (id, name, emoji, tag, category, eta_minutes, rating) values
  ('11111111-1111-1111-1111-111111111111','Brew Point','☕','Café · Block A','drinks',8,4.6),
  ('22222222-2222-2222-2222-222222222222','Main Canteen','🍛','Food court','food',10,4.4),
  ('33333333-3333-3333-3333-333333333333','QuickCopy','🖨️','Print · Block C','print',12,4.7),
  ('44444444-4444-4444-4444-444444444444','Campus Store','🏪','Stationery & more','stationery',9,4.5);

insert into products (vendor_id, name, description, emoji, category, price_paise) values
  ('11111111-1111-1111-1111-111111111111','Cold Coffee','Large, less sugar','🥤','drinks',7000),
  ('11111111-1111-1111-1111-111111111111','Iced Tea','Peach / lemon','🧋','drinks',5500),
  ('11111111-1111-1111-1111-111111111111','Grilled Sandwich','Paneer / veg','🥪','food',6500),
  ('22222222-2222-2222-2222-222222222222','Samosa','Crispy, per piece','🥟','food',1800),
  ('22222222-2222-2222-2222-222222222222','Veg Burger','With fries','🍔','food',9000),
  ('22222222-2222-2222-2222-222222222222','Maggi','Masala, hot','🍜','food',4000),
  ('44444444-4444-4444-4444-444444444444','A4 Notebook','200 pages, ruled','📝','stationery',6000),
  ('44444444-4444-4444-4444-444444444444','Gel Pen Pack','Pack of 5, blue','🖊️','stationery',5000),
  ('44444444-4444-4444-4444-444444444444','Chart Paper','White, per sheet','📐','stationery',1500),
  ('44444444-4444-4444-4444-444444444444','AA Batteries','Pack of 4','🔋','essentials',8000),
  ('44444444-4444-4444-4444-444444444444','Water Bottle','1L, chilled','💧','essentials',2000),
  ('33333333-3333-3333-3333-333333333333','B&W Printout','Per page','📄','print',200),
  ('33333333-3333-3333-3333-333333333333','Color Printout','Per page','🌈','print',1000),
  ('33333333-3333-3333-3333-333333333333','Spiral Binding','Per document','📚','print',4000);
