
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;
    const apiUrl = process.env.API_URL;

    if (!apiUrl) {
      return NextResponse.json(
        { status: 500, error: "API_URL belum dikonfigurasi" },
        { status: 500 }
      );
    }

    const response = await fetch(`${apiUrl}/facilities`, {
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {},
      cache: "no-store",
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("GET admin facilities error:", error);

    return NextResponse.json(
      { status: 500, error: "Gagal mengambil fasilitas" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;
    const apiUrl = process.env.API_URL;

    if (!token) {
      return NextResponse.json(
        { status: 401, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!apiUrl) {
      return NextResponse.json(
        { status: 500, error: "API_URL belum dikonfigurasi" },
        { status: 500 }
      );
    }

    const body = await request.json();

    const response = await fetch(`${apiUrl}/admin/facilities`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("POST admin facilities error:", error);

    return NextResponse.json(
      { status: 500, error: "Gagal menambahkan fasilitas" },
      { status: 500 }
    );
  }
}
