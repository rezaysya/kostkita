
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL;

type Context = {
  params: Promise<{
    id: string;
    imageId: string;
  }>;
};

export async function DELETE(
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

    const { id, imageId } = await context.params;

    const response = await fetch(
      `${API_URL}/owner/kosts/${id}/images/${imageId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      },
    );

    const result = await response.json();

    return NextResponse.json(result, {
      status: response.status,
    });
  } catch (error) {
    console.error("DELETE KOST IMAGE ERROR:", error);

    return NextResponse.json(
      { message: "Gagal menghapus gambar" },
      { status: 500 },
    );
  }
}
