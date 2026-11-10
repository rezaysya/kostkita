import { NextResponse } from "next/server";

const API_URL = process.env.API_URL;

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/facilities`, {
      cache: "no-store",
    });

    const result = await response.json();

    return NextResponse.json(result, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        error: {
          message: "Gagal mengambil daftar fasilitas",
        },
      },
      { status: 500 }
    );
  }
}