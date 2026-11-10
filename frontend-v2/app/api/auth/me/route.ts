
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL;

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { message: "Belum login" },
        { status: 401 },
      );
    }

    if (!API_URL) {
      return NextResponse.json(
        { message: "API_URL belum dikonfigurasi" },
        { status: 500 },
      );
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      const res = NextResponse.json(
        { message: result.error?.message ?? "Session tidak valid" },
        { status: response.status },
      );

      if (response.status === 401) {
        res.cookies.delete("access_token");
      }

      return res;
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { message: "Tidak dapat terhubung ke server" },
      { status: 500 },
    );
  }
}
