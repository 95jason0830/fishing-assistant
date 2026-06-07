import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const targetDate = searchParams.get('date');
  const targetHour = parseInt(searchParams.get('hour') || '-1');

  if (!lat || !lon) return NextResponse.json({ error: '需要提供座標' }, { status: 400 });

  try {
    const now = new Date();
    const forecastDate = targetDate ? new Date(targetDate) : now;
    const isToday = targetDate === now.toISOString().split('T')[0] || !targetDate;

    const latN = parseFloat(lat);
    const lonN = parseFloat(lon);
    const isSaltwater = lonN >= 118 && lonN <= 124 && latN >= 21 && latN <= 26;

    // 加入氣壓、水溫欄位
    const baseParams = `temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,cloud_cover,precipitation_probability,surface_pressure`;
    const seaParam = isSaltwater ? `,sea_surface_temperature` : '';

    const weatherUrl = isToday
      ? `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,cloud_cover,precipitation,surface_pressure${isSaltwater ? ',sea_surface_temperature' : ''}&hourly=${baseParams}${seaParam}&timezone=Asia/Taipei&forecast_days=2`
      : `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${baseParams}${seaParam}&timezone=Asia/Taipei&forecast_days=16`;

    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();

    const month = forecastDate.getMonth() + 1;
    const hour = targetHour >= 0 ? targetHour : now.getHours();
    const tidePhase = getTidePhase(hour, forecastDate);
    const moonPhase = getMoonPhase(forecastDate);
    const season = getSeason(month);

    let temperature: number, humidity: number, windSpeed: number, windDegree: number;
    let weatherCode: number, cloudCover: number, precipitation: number;
    let pressure: number, waterTemp: number | null = null;

    if (isToday && weatherData.current) {
      const c = weatherData.current;
      temperature = c.temperature_2m;
      humidity = c.relative_humidity_2m;
      windSpeed = c.wind_speed_10m;
      windDegree = c.wind_direction_10m;
      weatherCode = c.weather_code;
      cloudCover = c.cloud_cover;
      precipitation = c.precipitation;
      pressure = c.surface_pressure ?? 1013;
      waterTemp = c.sea_surface_temperature ?? null;
    } else {
      const hourly = weatherData.hourly;
      const targetTimeStr = `${targetDate}T${String(hour).padStart(2, '0')}:00`;
      let idx = hourly.time.findIndex((t: string) => t === targetTimeStr);
      if (idx < 0) idx = hourly.time.findIndex((t: string) => t.startsWith(targetDate || ''));
      if (idx < 0) idx = 0;

      temperature = hourly.temperature_2m[idx];
      humidity = hourly.relative_humidity_2m?.[idx] ?? 75;
      windSpeed = hourly.wind_speed_10m[idx];
      windDegree = hourly.wind_direction_10m[idx];
      weatherCode = hourly.weather_code[idx];
      cloudCover = hourly.cloud_cover?.[idx] ?? 50;
      precipitation = hourly.precipitation_probability?.[idx] ?? 0;
      pressure = hourly.surface_pressure?.[idx] ?? 1013;
      waterTemp = hourly.sea_surface_temperature?.[idx] ?? null;
    }

    // 氣壓趨勢（比較前3小時）
    let pressureTrend = 'stable';
    let pressureDiff = 0;
    if (weatherData.hourly?.surface_pressure && isToday) {
      const hIdx = weatherData.hourly.time.findIndex((t: string) => t.includes(`T${String(hour).padStart(2,'0')}:00`));
      if (hIdx >= 3) {
        pressureDiff = pressure - weatherData.hourly.surface_pressure[hIdx - 3];
        if (pressureDiff > 2) pressureTrend = 'rising';
        else if (pressureDiff < -2) pressureTrend = 'falling';
      }
    }

    // 月亮活動表（Solunar Theory）
    const solunar = calcSolunar(forecastDate, latN, lonN);

    // 日出日落
    const sunTimes = calcSunTimes(forecastDate, latN, lonN);

    // 逐小時預報
    const hourlyForecast = [];
    if (weatherData.hourly && targetDate) {
      for (let h = 0; h < 24; h++) {
        const timeStr = `${targetDate}T${String(h).padStart(2, '0')}:00`;
        const idx = weatherData.hourly.time.indexOf(timeStr);
        if (idx >= 0) {
          hourlyForecast.push({
            hour: h,
            temp: weatherData.hourly.temperature_2m[idx],
            wind: weatherData.hourly.wind_speed_10m[idx],
            weatherCode: weatherData.hourly.weather_code[idx],
            pressure: weatherData.hourly.surface_pressure?.[idx] ?? null,
            tide: getTidePhase(h, forecastDate),
          });
        }
      }
    }

    const windDir = getWindDirection(windDegree);
    const weatherDesc = getWeatherDescription(weatherCode);

    // 氣壓釣魚建議
    const pressureAdvice = getPressureAdvice(pressureTrend, pressureDiff);

    return NextResponse.json({
      temperature, humidity, windSpeed, windDirection: windDir, windDegree,
      weatherCode, weatherDesc, cloudCover, precipitation,
      tide: tidePhase, moonPhase, season,
      pressure: Math.round(pressure),
      pressureTrend,
      pressureDiff: Math.round(pressureDiff * 10) / 10,
      pressureAdvice,
      waterTemp: waterTemp ? Math.round(waterTemp * 10) / 10 : null,
      solunar,
      sunTimes,
      time: forecastDate.toLocaleDateString('zh-TW') + (targetHour >= 0 ? ` ${String(targetHour).padStart(2,'0')}:00` : ''),
      month, hour,
      targetDate: targetDate || now.toISOString().split('T')[0],
      hourlyForecast,
    });
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json({ error: '無法取得天氣資料' }, { status: 500 });
  }
}

function getWindDirection(degree: number): string {
  const dirs = ['北','北北東','東北','東北東','東','東南東','東南','南南東','南','南南西','西南','西南西','西','西北西','西北','北北西'];
  return dirs[Math.round(degree / 22.5) % 16];
}

function getWeatherDescription(code: number): string {
  if (code === 0) return '晴天';
  if (code <= 3) return '多雲';
  if (code <= 49) return '霧';
  if (code <= 69) return '小雨';
  if (code <= 79) return '雪';
  if (code <= 82) return '陣雨';
  if (code <= 99) return '雷陣雨';
  return '未知';
}

function getTidePhase(hour: number, date: Date): string {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const tideOffset = (dayOfYear * 0.8) % 6;
  const adjustedHour = (hour + tideOffset) % 12;
  if (adjustedHour < 1.5) return '低潮';
  if (adjustedHour < 4.5) return '漲潮';
  if (adjustedHour < 6) return '高潮';
  if (adjustedHour < 9) return '退潮';
  if (adjustedHour < 10.5) return '低潮';
  return '漲潮';
}

function getMoonPhase(date: Date): string {
  const year = date.getFullYear(), month = date.getMonth() + 1, day = date.getDate();
  const jd = (year - 1900) * 365.25 + (month - 1) * 30.6 + day;
  const phase = jd % 29.53;
  if (phase < 1.85) return '新月';
  if (phase < 7.38) return '眉月';
  if (phase < 9.22) return '上弦月';
  if (phase < 14.77) return '漸盈凸月';
  if (phase < 16.61) return '滿月';
  if (phase < 22.15) return '漸虧凸月';
  if (phase < 23.99) return '下弦月';
  return '殘月';
}

function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return '春';
  if (month >= 6 && month <= 8) return '夏';
  if (month >= 9 && month <= 11) return '秋';
  return '冬';
}

function getPressureAdvice(trend: string, diff: number): string {
  if (trend === 'falling' && diff < -5) return '⚠️ 氣壓急速下降，魚類躲往深水，釣況可能很差';
  if (trend === 'falling') return '🟡 氣壓下降中，魚類開始活躍進食，是好時機！';
  if (trend === 'rising') return '🔵 氣壓上升中，魚類趨於保守，需要耐心';
  return '🟢 氣壓穩定，正常釣況';
}

// Solunar 月亮活動表計算
function calcSolunar(date: Date, lat: number, lon: number) {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525;

  // 月亮赤經（簡化計算）
  const moonLon = (218.316 + 13.176396 * (JD - 2451545.0)) % 360;
  const moonRise = ((moonLon - lon) / 15 + 12) % 24;
  const moonSet  = (moonRise + 12.4) % 24;
  const moonOver = (moonRise + 6.2) % 24;
  const moonUnder = (moonRise + 18.6) % 24;

  const fmt = (h: number) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  };

  // 月相影響強度
  const year = date.getFullYear(), month = date.getMonth()+1, day = date.getDate();
  const jd2 = (year - 1900) * 365.25 + (month - 1) * 30.6 + day;
  const phase = jd2 % 29.53;
  const isNewOrFull = phase < 2 || (phase > 13.5 && phase < 16);
  const rating = isNewOrFull ? 5 : phase < 7 || phase > 22 ? 3 : 4;

  return {
    major: [
      { time: fmt(moonRise), label: '月出', duration: 120 },
      { time: fmt(moonSet),  label: '月落', duration: 120 },
    ],
    minor: [
      { time: fmt(moonOver),  label: '月中天', duration: 60 },
      { time: fmt(moonUnder), label: '月下中天', duration: 60 },
    ],
    rating,
    ratingLabel: ['','⭐','⭐⭐','⭐⭐⭐','⭐⭐⭐⭐','⭐⭐⭐⭐⭐'][rating],
    note: isNewOrFull ? '新月/滿月期，Solunar 效應最強，爆釣機率高' : '正常釣況',
  };
}

// 日出日落計算
function calcSunTimes(date: Date, lat: number, lon: number) {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const n = JD - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
  const eps = 23.439 * Math.PI / 180;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const latR = lat * Math.PI / 180;
  const cosH = (Math.cos(96 * Math.PI / 180) - Math.sin(dec) * Math.sin(latR)) / (Math.cos(dec) * Math.cos(latR));
  if (Math.abs(cosH) > 1) return { sunrise: '06:00', sunset: '18:00', goldenMorning: '05:00–06:00', goldenEvening: '18:00–19:00' };

  const H = Math.acos(cosH) * 180 / Math.PI;
  const transit = 12 - (L - lon) / 15;
  const sunrise = transit - H / 15;
  const sunset  = transit + H / 15;

  const fmt = (h: number) => {
    const hh = ((Math.floor(h) % 24) + 24) % 24;
    const mm = Math.round((h - Math.floor(h)) * 60) % 60;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  };

  return {
    sunrise: fmt(sunrise),
    sunset:  fmt(sunset),
    goldenMorning: `${fmt(sunrise - 1)}–${fmt(sunrise + 1)}`,
    goldenEvening: `${fmt(sunset - 1)}–${fmt(sunset + 1)}`,
  };
}
