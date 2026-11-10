
import Link from "next/link";
import { MapPin, DoorOpen, Image as ImageIcon } from "lucide-react";
import { Kost, formatPrice } from "@/lib/kost";
import FavoriteButton from "@/components/FavoriteButton";

type KostCardProps = {
  kost: Kost;
};

export default function KostCard({ kost }: KostCardProps) {
  const imageUrl = kost.images
    ?.slice()
    .sort((a, b) => a.sort_order - b.sort_order)[0]?.image_url;

  return (
    <article className="kost-card">
      <div className="kost-card-image">
        <Link href={`/kost/${kost.id}`} className="kost-card-link">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={kost.name} />
          ) : (
            <div className="kost-image-placeholder">
              <ImageIcon size={32} />
              <span>Foto kost belum tersedia</span>
            </div>
          )}

          <span className="kost-status">Tersedia</span>
        </Link>

        <FavoriteButton kostId={kost.id} />
      </div>

      <Link href={`/kost/${kost.id}`} className="kost-card-link">
        <div className="kost-content">
          <span className="kost-location">
            <MapPin size={14} />
            {kost.city}, {kost.province}
          </span>

          <h3>{kost.name}</h3>

          <p className="kost-description">{kost.description}</p>

          <div className="kost-card-bottom">
            <span className="kost-rooms">
              <DoorOpen size={14} />
              {kost.available_rooms} kamar tersedia
            </span>

            <div className="kost-price">
              {formatPrice(kost.price)}
              <small> / bulan</small>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
