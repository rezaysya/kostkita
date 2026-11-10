
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) {
      return NextResponse.json(
        {
          status: 401,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_URL;

    if (!apiUrl) {
      return NextResponse.json(
        {
          status: 500,
          error: "API_URL belum dikonfigurasi",
        },
        { status: 500 }
      );
    }

    const response = await fetch(`${apiUrl}/admin/kosts`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("GET /api/admin/kosts error:", error);

    return NextResponse.json(
      {
        status: 500,
        error: "Gagal mengambil data kost",
      },
      { status: 500 }
    );
  }
}
