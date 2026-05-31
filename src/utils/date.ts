import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/ar";
import "dayjs/locale/en";

dayjs.extend(relativeTime);

export const formatRelativeDate = (date: string | Date, lang: string = "en") => {
    return dayjs(date).locale(lang).fromNow();
};

export const formatDate = (date: string | Date, format: string = "DD MMM YYYY", lang: string = "en") => {
    return dayjs(date).locale(lang).format(format);
};