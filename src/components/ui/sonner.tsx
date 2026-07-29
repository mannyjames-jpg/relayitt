import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        duration: 3500,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-foreground group-[.toaster]:text-background group-[.toaster]:border group-[.toaster]:border-foreground group-[.toaster]:rounded-none group-[.toaster]:shadow-none",
          description: "group-[.toast]:text-background/70",
          actionButton:
            "group-[.toast]:bg-background group-[.toast]:text-foreground group-[.toast]:font-semibold group-[.toast]:uppercase group-[.toast]:tracking-[0.08em] group-[.toast]:text-[10px] group-[.toast]:rounded-none",
          cancelButton:
            "group-[.toast]:bg-transparent group-[.toast]:border group-[.toast]:border-background/40 group-[.toast]:text-background/80 group-[.toast]:rounded-none",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
