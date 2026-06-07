import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEFAULT_SPOTS = [
  { name: '基隆外木山', latitude: 25.143, longitude: 121.726, water_type: 'saltwater', description: '北部著名磯釣場，黑毛、白毛、石斑', target_fish: '黑毛,白毛,石斑,鱸魚', best_season: '全年', source: '系統預設' },
  { name: '野柳漁港', latitude: 25.204, longitude: 121.688, water_type: 'saltwater', description: '北海岸熱門釣點，多樣魚種', target_fish: '鱸魚,黑鯛,花身仔', best_season: '春秋', source: '系統預設' },
  { name: '淡水河口', latitude: 25.175, longitude: 121.440, water_type: 'saltwater', description: '河口生態豐富，適合岸釣', target_fish: '鱸魚,烏魚,鯔魚', best_season: '秋冬', source: '系統預設' },
  { name: '石門水庫', latitude: 24.794, longitude: 121.248, water_type: 'freshwater', description: '北部最大水庫，大物雲集', target_fish: '大頭鰱,草魚,吳郭魚,鯉魚', best_season: '春夏', source: '系統預設' },
  { name: '日月潭', latitude: 23.860, longitude: 120.911, water_type: 'freshwater', description: '中部著名湖泊，奇力魚故鄉', target_fish: '奇力魚,吳郭魚,鱸魚', best_season: '全年', source: '系統預設' },
  { name: '花蓮漁港', latitude: 23.970, longitude: 121.612, water_type: 'saltwater', description: '東部港口，旗魚、鬼頭刀季節性出沒', target_fish: '旗魚,鬼頭刀,飛魚', best_season: '夏', source: '系統預設' },
  { name: '墾丁後壁湖', latitude: 21.960, longitude: 120.762, water_type: 'saltwater', description: '南端磯釣天堂，魚種多樣', target_fish: '黑毛,石斑,鸚鵡魚,臭肚', best_season: '全年', source: '系統預設' },
  { name: '曾文水庫', latitude: 23.255, longitude: 120.519, water_type: 'freshwater', description: '南部最大水庫，大頭鰱聖地', target_fish: '大頭鰱,草魚,鯉魚', best_season: '春夏', source: '系統預設' },
  { name: '蘇澳港', latitude: 24.598, longitude: 121.862, water_type: 'saltwater', description: '東北角港口，多元釣種', target_fish: '鱸魚,黑鯛,石斑', best_season: '秋冬', source: '系統預設' },
  { name: '澎湖馬公港', latitude: 23.567, longitude: 119.567, water_type: 'saltwater', description: '離島精華釣場', target_fish: '石斑,黑毛,紅甘', best_season: '夏秋', source: '系統預設' },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const waterType = searchParams.get('water_type');

    // 若資料庫是空的，插入預設釣點
    const { count } = await supabase.from('fishing_spots').select('*', { count: 'exact', head: true });
    if ((count || 0) === 0) {
      await supabase.from('fishing_spots').insert(DEFAULT_SPOTS);
    }

    let query = supabase.from('fishing_spots').select('*').order('name');
    if (waterType && waterType !== 'all') query = query.eq('water_type', waterType);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = await supabase.from('fishing_spots').insert({
      name: body.name,
      latitude: body.latitude,
      longitude: body.longitude,
      water_type: body.water_type || 'saltwater',
      description: body.description || '',
      target_fish: body.target_fish || '',
      best_season: body.best_season || '全年',
      source: body.source || '手動新增',
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ id: data.id, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
