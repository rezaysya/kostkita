
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL;

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function forwardRequest(
  request: NextRequest,
  context: RouteContext,
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

    const { id } = await context.params;

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    };

    if (method === "PUT") {
      options.headers = {
        ...options.headers,
        "Content-Type": "application/json",
      };
      options.body = await request.text();
    }

    const response = await fetch(
      `${API_URL}/owner/kosts/${id}`,
      options,
    );

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const responseText = await response.text();

    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ??
          "application/json",
      },
    });
  } catch (error) {
    console.error("OWNER KOST API ERROR:", error);

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
  return forwardRequest(request, context, "GET");
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  return forwardRequest(request, context, "PUT");
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  return forwardRequest(request, context, "DELETE");
}
