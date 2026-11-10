
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL;

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function forwardRequest(
  request: NextRequest,
  id: string,
  method: "GET" | "PUT" | "DELETE",
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

    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
    };

    const options: RequestInit = {
      method,
      headers,
      cache: "no-store",
    };

    if (method === "PUT") {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(await request.json());
    }

    const response = await fetch(
      `${API_URL}/owner/kosts/${id}`,
      options,
    );

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

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

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  return forwardRequest(request, id, "GET");
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  return forwardRequest(request, id, "PUT");
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  return forwardRequest(request, id, "DELETE");
}
