// Supabase 값을 넣으면 온라인으로 연결된다. 비워 두면 같은 컴퓨터의 탭끼리만 연결된다.
// 공개용 키(publishable/anon)만 넣을 것. service_role 키는 절대 넣지 않는다.
// about = 판 왼쪽 위에 들어가는 우리 글 (줄바꿈은 \n)
globalThis.RECORD_CONFIG = {
  supabaseUrl: 'https://moyujxduykmtvxjzexvy.supabase.co',
  supabaseKey: 'sb_publishable_rZiIJYlKfHgohTgNeNciiA_aioE9Pq8',
  about: '기록하는 것에 매력을 느껴서 만들었습니다.\n무엇이든, 어떤 방식이든 괜찮습니다.\n원하는 곳에 남겨주세요!',
};
