const paths = {
  close: "M6 6l12 12M18 6 6 18",
  left: "M19 12H5m7-7-7 7 7 7",
  right: "M5 12h14m-7-7 7 7-7 7",
  down: "m6 9 6 6 6-6",
  check: "m5 12 4 4L19 6",
  plus: "M12 5v14M5 12h14",
};

export default function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
