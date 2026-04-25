import { addDays, format } from "date-fns";
import { tr } from "date-fns/locale";
import { Component, type ComponentType } from "react";
import { type NavigateAction } from "react-big-calendar";
// `TimeGrid` RBC'nin public ESM index'inde **yok** (TS .d.ts yanıltıcı).
// Week.js dahili olarak da bu deep import'u kullanıyor — RBC'nin
// "create custom view" rehberinde önerilen yol. .d.ts olmadığı için
// `@ts-expect-error` ile geçiyoruz.
// @ts-expect-error — no .d.ts for deep import path; RBC docs recommend this
import TimeGrid from "react-big-calendar/lib/TimeGrid";

/**
 * RBC'nin yerleşik Week view'ı `startOfWeek`'e snap'lenir; "Sonraki"
 * daima 7 günlük takvimsel haftaya kaydırır. Sürüş okulu planlamasında
 * kullanıcı her tıklamada 1 gün ileri/geri kaymak istiyor (kayan
 * pencere). RBC custom view API'si tam bu için: kendi component'imiz
 * `TimeGrid`'i sarar ve statik `range`/`navigate`/`title` metotlarıyla
 * pencere mantığını verir.
 *
 * Buradaki factory ile aynı kalıptan farklı pencere uzunlukları
 * (7-gün, 14-gün) üretiyoruz.
 */

type RollingProps = {
  date: Date;
  // RBC component'e Calendar'dan geçen tüm prop'ları yansıtır
  // (events, accessors, vb.); TimeGrid'e olduğu gibi iletiyoruz.
  [key: string]: unknown;
};

const formatTitle = (start: Date, end: Date) => {
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${format(start, "d", { locale: tr })} – ${format(end, "d MMMM yyyy", {
      locale: tr,
    })}`;
  }
  if (sameYear) {
    return `${format(start, "d MMM", { locale: tr })} – ${format(end, "d MMM yyyy", {
      locale: tr,
    })}`;
  }
  return `${format(start, "d MMM yyyy", { locale: tr })} – ${format(end, "d MMM yyyy", {
    locale: tr,
  })}`;
};

type RollingViewClass = ComponentType<RollingProps> & {
  range: (date: Date) => Date[];
  navigate: (date: Date, action: NavigateAction) => Date;
  title: (date: Date) => string;
};

const createRollingView = (length: number): RollingViewClass => {
  class RollingView extends Component<RollingProps> {
    static range(date: Date): Date[] {
      return Array.from({ length }, (_, i) => addDays(date, i));
    }

    static navigate(date: Date, action: NavigateAction): Date {
      switch (action) {
        case "PREV":
          return addDays(date, -1);
        case "NEXT":
          return addDays(date, 1);
        default:
          return date;
      }
    }

    static title(date: Date): string {
      return formatTitle(date, addDays(date, length - 1));
    }

    render() {
      const { date, localizer, min, max, scrollToTime, enableAutoScroll, ...rest } =
        this.props as RollingProps & {
          localizer: { startOf: (d: Date, unit: string) => Date; endOf: (d: Date, unit: string) => Date };
          min?: Date;
          max?: Date;
          scrollToTime?: Date;
          enableAutoScroll?: boolean;
        };
      const range = RollingView.range(date);
      // RBC'nin yerleşik Week.js'i min/max/scrollToTime için localizer
      // default'larını resolve eder; biz TimeGrid'e doğrudan delegate
      // ettiğimiz için aynı resolution'ı burada yapmazsak TimeGutter
      // boş slot dönüyor ve saat etiketleri render edilmiyor (DOM'da
      // `<div class="rbc-time-gutter">` tamamen boş kalıyor).
      const resolvedMin = min ?? localizer.startOf(new Date(), "day");
      const resolvedMax = max ?? localizer.endOf(new Date(), "day");
      const resolvedScrollToTime = scrollToTime ?? localizer.startOf(new Date(), "day");
      const resolvedAutoScroll = enableAutoScroll ?? true;
      const TimeGridAny = TimeGrid as unknown as ComponentType<Record<string, unknown>>;
      return (
        <TimeGridAny
          {...rest}
          date={date}
          range={range}
          eventOffset={15}
          localizer={localizer}
          min={resolvedMin}
          max={resolvedMax}
          scrollToTime={resolvedScrollToTime}
          enableAutoScroll={resolvedAutoScroll}
        />
      );
    }
  }
  return RollingView as unknown as RollingViewClass;
};

export const RollingWeekView = createRollingView(7);
export const RollingTwoWeeksView = createRollingView(14);
export const RollingThreeWeeksView = createRollingView(21);
export const RollingFourWeeksView = createRollingView(28);
