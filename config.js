// Supabase 값을 넣으면 온라인으로 연결된다. 비워 두면 같은 컴퓨터의 탭끼리만 연결된다.
// 공개용 키(publishable/anon)만 넣을 것. service_role 키는 절대 넣지 않는다.
// quote·cite = 왼쪽 위 인용문과 출처. 그 아래 「글·그림·사진·앨범」 문장은 index.html에 (단어가 곧 버튼)
// timeStyle = 'always'(기록 아래 늘 작게) | 'tap'(기록을 누르면)
globalThis.RECORD_CONFIG = {
  supabaseUrl: 'https://moyujxduykmtvxjzexvy.supabase.co',
  supabaseKey: 'sb_publishable_rZiIJYlKfHgohTgNeNciiA_aioE9Pq8',
  quote: '“미래에 무엇을 그리워할지 모르기 때문에 몽땅 저장하는 게 최선이라는 식이다.”',
  cite: '그래프턴 태너, 『포에버리즘』',
  timeStyle: 'always',
};
