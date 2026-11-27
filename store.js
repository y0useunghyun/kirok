// 연결 계층. 설정이 있으면 Supabase, 없으면 이 브라우저(localStorage) + 같은 컴퓨터 탭끼리(BroadcastChannel).
(function (root) {
  const { supabaseUrl, supabaseKey } = root.RECORD_CONFIG || {};
  const client = supabaseUrl && supabaseKey && root.supabase
    ? root.supabase.createClient(supabaseUrl, supabaseKey)
    : null;

  const KEY = 'record-sheet:entries';
  const bc = 'BroadcastChannel' in root ? new BroadcastChannel(KEY) : null;

  function readLocal() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  }

  const local = {
    online: false,
    async list() {
      return readLocal();
    },
    async add(entry) {
      const row = { ...entry, created_at: new Date().toISOString() };
      try {
        localStorage.setItem(KEY, JSON.stringify([...readLocal(), row]));
      } catch {
        throw new Error('이 브라우저에 더 저장할 자리가 없어요');
      }
      bc?.postMessage(row);
      return row;
    },
    subscribe(cb) {
      bc?.addEventListener('message', (ev) => cb(ev.data));
    },
  };

  // ponytail: 모든 기록을 한 번에 불러옴. 수천 개가 넘으면 나눠 불러올 것.
  const remote = {
    online: true,
    async list() {
      const { data, error } = await client.from('entries').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
    async add(entry) {
      const { data, error } = await client.from('entries').insert(entry).select().single();
      if (error) throw error;
      return data;
    },
    subscribe(cb) {
      client
        .channel('entries')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'entries' }, (p) => cb(p.new))
        .subscribe();
    },
  };

  root.RecordStore = client ? remote : local;
})(globalThis);
