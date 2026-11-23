-- Supabase SQL Editor에서 한 번 실행한다.
-- 누구나 읽고 쓸 수 있지만 수정·삭제는 막는다(기록은 남는다).
-- 사진은 줄인 JPEG, 그림은 투명 PNG를 글자(data URL)로 같이 저장한다.
-- ponytail: 행사 하루 규모라 Storage 버킷 없이 표에 바로 넣음. 사진이 수천 장이면 Storage로 옮길 것.
create table if not exists public.entries (
  id text primary key check (char_length(id) <= 40),
  room text not null default 'a' check (room in ('a', 'b')), -- A반 / B반
  x real not null check (x between 0 and 1),
  y real not null check (y between 0 and 1),
  text text check (char_length(text) <= 200),
  photo text check (photo is null or ((photo like 'data:image/jpeg;base64,%' or photo like 'data:image/png;base64,%') and char_length(photo) <= 600000)),
  w real check (w is null or (w > 0 and w <= 1)), -- 사진·그림 폭 (종이 폭 대비)
  created_at timestamptz not null default now(),
  check (text is not null or photo is not null)
);

alter table public.entries enable row level security;

create policy "entries_read" on public.entries for select to anon using (true);
create policy "entries_add" on public.entries for insert to anon with check (true);

grant select, insert on public.entries to anon;

alter publication supabase_realtime add table public.entries;
