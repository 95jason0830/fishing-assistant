import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data: logs, error, count } = await supabase
      .from('fishing_logs')
      .select('*, catches(*)', { count: 'exact' })
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const logsWithSummary = (logs || []).map((log: any) => ({
      ...log,
      total_catch: log.catches?.reduce((s: number, c: any) => s + (c.quantity || 0), 0) || 0,
      catch_summary: log.catches?.map((c: any) => `${c.fish_name}×${c.quantity}`).join('、') || '',
    }));

    return NextResponse.json({ logs: logsWithSummary, total: count || 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { log, catches } = body;

    const { data: logData, error: logError } = await supabase
      .from('fishing_logs')
      .insert({
        date: log.date || new Date().toISOString().split('T')[0],
        location_name: log.location_name || null,
        latitude: log.latitude || null,
        longitude: log.longitude || null,
        water_type: log.water_type || null,
        weather: log.weather || null,
        temperature: log.temperature || null,
        wind_direction: log.wind_direction || null,
        wind_speed: log.wind_speed || null,
        tide: log.tide || null,
        moon_phase: log.moon_phase || null,
        water_temp: log.water_temp || null,
        pressure: log.pressure || null,
        target_fish: log.target_fish || null,
        technique: log.technique || null,
        rod_type: log.rod_type || null,
        reel_type: log.reel_type || null,
        line_type: log.line_type || null,
        lure_bait: log.lure_bait || null,
        depth: log.depth || null,
        notes: log.notes || null,
        ai_suggestion: log.ai_suggestion || null,
      })
      .select()
      .single();

    if (logError) throw logError;

    if (catches?.length) {
      const catchRows = catches
        .filter((c: any) => c.fish_name)
        .map((c: any) => ({
          log_id: logData.id,
          fish_name: c.fish_name,
          quantity: c.quantity || 1,
          weight_g: c.weight_g || null,
          length_cm: c.length_cm || null,
          ai_identified: c.ai_identified || false,
          released: c.released || false,
        }));
      if (catchRows.length) {
        const { error: catchError } = await supabase.from('catches').insert(catchRows);
        if (catchError) throw catchError;
      }
    }

    // 更新釣點訪問紀錄
    if (log.latitude && log.longitude) {
      const { data: spots } = await supabase
        .from('fishing_spots')
        .select('id, visit_count')
        .filter('latitude', 'gte', log.latitude - 0.01)
        .filter('latitude', 'lte', log.latitude + 0.01)
        .filter('longitude', 'gte', log.longitude - 0.01)
        .filter('longitude', 'lte', log.longitude + 0.01);
      if (spots?.length) {
        await supabase.from('fishing_spots').update({ visit_count: (spots[0].visit_count || 0) + 1, last_visited: log.date }).eq('id', spots[0].id);
      }
    }

    return NextResponse.json({ id: logData.id, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    const { error } = await supabase.from('fishing_logs').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
