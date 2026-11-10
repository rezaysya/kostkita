
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const response = await fetch(`${API_URL}/kosts/${id}`, {
      method: "GET",
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
          message: "Gagal mengambil detail kost",
        },
      },
      { status: 500 }
    );
  }
}
