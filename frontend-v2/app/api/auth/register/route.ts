
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL;

export async function POST(request: NextRequest) {
  try {
    if (!API_URL) {
      return NextResponse.json(
        { message: "API_URL belum dikonfigurasi" },
        { status: 500 },
      );
    }

    const body = await request.json();

    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok || result.status === "error") {
      return NextResponse.json(
        {
          message: result.error?.message ?? "Registrasi gagal",
        },
        { status: response.status },
      );
    }

    const { user, access_token } = result.data;

    const res = NextResponse.json({
      status: "success",
      data: { user },
    });

    res.cookies.set("access_token", access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return res;
  } catch {
    return NextResponse.json(
      { message: "Tidak dapat terhubung ke server" },
      { status: 500 },
    );
  }
}
