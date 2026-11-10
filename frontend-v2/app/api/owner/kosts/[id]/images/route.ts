
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL;

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: NextRequest,
  context: Context,
) {
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

    const { id } = await context.params;
    const body = await request.json();

    const response = await fetch(
      `${API_URL}/owner/kosts/${id}/images`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );

    const result = await response.json();

    return NextResponse.json(result, {
      status: response.status,
    });
  } catch (error) {
    console.error("ADD KOST IMAGE ERROR:", error);

    return NextResponse.json(
      { message: "Gagal menambahkan gambar" },
      { status: 500 },
    );
  }
}
