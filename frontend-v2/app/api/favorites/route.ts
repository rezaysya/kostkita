
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL;

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { message: "Silakan login terlebih dahulu" },
        { status: 401 },
      );
    }

    if (!API_URL) {
      return NextResponse.json(
        { message: "API_URL belum dikonfigurasi" },
        { status: 500 },
      );
    }

    const response = await fetch(`${API_URL}/favorites`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const result = await response.json();

    return NextResponse.json(result, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { message: "Tidak dapat terhubung ke server" },
      { status: 500 },
    );
  }
}
