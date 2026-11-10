
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
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

    const response = await fetch(`${apiUrl}/admin/facilities/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("DELETE admin facility error:", error);

    return NextResponse.json(
      { status: 500, error: "Gagal menghapus fasilitas" },
      { status: 500 }
    );
  }
}
