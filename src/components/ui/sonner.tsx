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
            "group toast group-[.toaster]:bg-[#3D2B30] group-[.toaster]:text-[#FDF3F1] group-[.toaster]:border-transparent group-[.toaster]:rounded-2xl group-[.toaster]:shadow-xl",
          description: "group-[.toast]:text-[#E6CFD3]",
          actionButton:
            "group-[.toast]:bg-[#FBE7EC] group-[.toast]:text-[#C25777] group-[.toast]:font-semibold group-[.toast]:rounded-full",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-[#E6CFD3]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
