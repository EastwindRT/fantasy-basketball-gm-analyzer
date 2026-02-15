import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DEFAULT_CONFIG } from '@/lib/admin-config';
import { isValidAdminToken } from '@/lib/admin-auth';

const CONFIG_PATH = path.join(process.cwd(), 'config', 'admin-settings.json');

export async function GET() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const config = JSON.parse(raw);
      return NextResponse.json(config);
    }
    return NextResponse.json(DEFAULT_CONFIG);
  } catch {
    return NextResponse.json(DEFAULT_CONFIG);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !isValidAdminToken(token)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const config = await request.json();

    if (!config.version || !Array.isArray(config.tabs) || !config.theme || !config.dataDisplay) {
      return NextResponse.json(
        { error: 'Invalid config structure' },
        { status: 400 }
      );
    }

    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Failed to save config' },
      { status: 500 }
    );
  }
}
