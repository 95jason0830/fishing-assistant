import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { count: totalSessions } = await supabase.from('fishing_logs').select('*', { count: 'exact', head: true });
    const { data: catchSum } = await supabase.from('catches').select('quantity');
    const totalCatch = catchSum?.reduce((s, c) => s + (c.quantity || 0), 0) || 0;

    // 魚種統計
    const { data: catchesAll } = await supabase.from('catches').select('fish_name, quantity');
    const fishMap: Record<string, { total: number; times: number }> = {};
    for (const c of catchesAll || []) {
      if (!fishMap[c.fish_name]) fishMap[c.fish_name] = { total: 0, times: 0 };
      fishMap[c.fish_name].total += c.quantity || 0;
      fishMap[c.fish_name].times += 1;
    }
    const fishStats = Object.entries(fishMap)
      .map(([fish_name, v]) => ({ fish_name, ...v }))
      .sort((a, b) => b.total - a.total).slice(0, 10);
    const speciesCount = Object.keys(fishMap).length;

    // 釣點統計
    const { data: logs } = await supabase.from('fishing_logs').select('location_name, date, technique');
    const spotMap: Record<string, number> = {};
    for (const l of logs || []) if (l.location_name) spotMap[l.location_name] = (spotMap[l.location_name] || 0) + 1;
    const spotStats = Object.entries(spotMap).map(([location_name, visits]) => ({ location_name, visits })).sort((a, b) => b.visits - a.visits).slice(0, 5);

    // 釣法統計
    const techMap: Record<string, number> = {};
    for (const l of logs || []) if (l.technique) techMap[l.technique] = (techMap[l.technique] || 0) + 1;
    const techniqueStats = Object.entries(techMap).map(([technique, uses]) => ({ technique, uses })).sort((a, b) => b.uses - a.uses).slice(0, 5);

    // 月度統計
    const monthMap: Record<string, { sessions: number; catches: number }> = {};
    for (const l of logs || []) {
      const m = (l.date || '').substring(0, 7);
      if (!monthMap[m]) monthMap[m] = { sessions: 0, catches: 0 };
      monthMap[m].sessions += 1;
    }
    for (const c of catchesAll || []) {
      // 需要 log 的日期，簡化處理
    }
    const monthlyStats = Object.entries(monthMap).map(([month, v]) => ({ month, ...v })).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
    const bestMonth = monthlyStats.reduce((best, m) => (!best || m.sessions > best.sessions) ? m : best, null as any);

    // 最近 5 筆
    const { data: recentLogs } = await supabase.from('fishing_logs').select('date, location_name, target_fish, technique').order('date', { ascending: false }).limit(5);

    return NextResponse.json({ totalSessions: totalSessions || 0, totalCatch, speciesCount, fishStats, spotStats, techniqueStats, monthlyStats, recentLogs, bestMonth });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
