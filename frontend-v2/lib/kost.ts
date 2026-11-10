
export type KostImage = {
  id: number;
  kost_id: number;
  image_url: string;
  sort_order: number;
  created_at: string;
};

export type KostFacility = {
  id: number;
  name: string;
};

export type Kost = {
  id: number;
  owner_id: number;
  name: string;
  description: string;
  price: number;
  address: string;
  city: string;
  province: string;
  available_rooms: number;
  status: "draft" | "published" | "rejected";
  images: KostImage[];
  facilities: KostFacility[];
};

export function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}
