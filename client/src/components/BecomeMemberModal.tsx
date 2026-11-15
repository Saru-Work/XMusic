import { useState } from "react";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Field, FieldError, FieldGroup } from "./ui/field";
import { Input } from "./ui/input";
import ImagePicker from "./ImagePicker";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store/store";
import { storeUser, type UserState } from "../reducers/userReducer";
import { api, errorMessage } from "@/lib/api";
import { FormError, Spinner, primaryButton, secondaryButton } from "./States";

const formSchema = z.object({
  title: z.string().trim().min(1, "Artist name is required"),
  bio: z.string().trim().min(1, "Bio is required"),
  img: z.instanceof(File, { message: "Choose a profile image" }),
});
type FormValues = z.infer<typeof formSchema>;

const BecomeMemberModal = ({
  open,
  handleOpen,
}: {
  open: boolean;
  handleOpen: (open: boolean) => void;
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", bio: "" },
  });
  const { errors, isSubmitting } = form.formState;

  function setOpen(next: boolean) {
    if (!next) {
      form.reset();
      setServerError(null);
    }
    handleOpen(next);
  }

  async function handleSubmit(values: FormValues) {
    setServerError(null);
    const formData = new FormData();
    formData.append("title", values.title);
    formData.append("bio", values.bio);
    formData.append("image", values.img);
    try {
      const data = await api<{ user: UserState }>("/artist/createArtist", {
        method: "POST",
        form: formData,
      });
      dispatch(storeUser(data.user));
      setOpen(false);
    } catch (err) {
      setServerError(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-none bg-[#1c1c1c] text-gray-200">
        <DialogHeader>
          <DialogTitle>Become an artist</DialogTitle>
          <DialogDescription>
            Create an artist profile to publish albums and upload songs.
          </DialogDescription>
        </DialogHeader>
        {/* Remount with the dialog so the image preview resets too */}
        {open && (
          <form onSubmit={form.handleSubmit(handleSubmit)} noValidate>
            <FieldGroup>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Controller
                  name="img"
                  control={form.control}
                  render={({ field }) => (
                    <Field className="w-auto">
                      <ImagePicker
                        label="Profile image"
                        onChange={field.onChange}
                      />
                      <FieldError errors={[errors.img]} />
                    </Field>
                  )}
                />
                <div className="flex flex-1 flex-col gap-4">
                  <Field data-invalid={!!errors.title}>
                    <Label htmlFor="artist-name">Artist name</Label>
                    <Input
                      id="artist-name"
                      placeholder="Pedro Duarte"
                      autoFocus
                      aria-invalid={!!errors.title}
                      {...form.register("title")}
                    />
                    <FieldError errors={[errors.title]} />
                  </Field>
                  <Field data-invalid={!!errors.bio}>
                    <Label htmlFor="artist-bio">Bio</Label>
                    <Input
                      id="artist-bio"
                      placeholder="I make pop music"
                      aria-invalid={!!errors.bio}
                      {...form.register("bio")}
                    />
                    <FieldError errors={[errors.bio]} />
                  </Field>
                </div>
              </div>
              <FormError message={serverError} />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button className={primaryButton} disabled={isSubmitting}>
                  {isSubmitting && <Spinner size={14} />}
                  Create profile
                </button>
              </div>
            </FieldGroup>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BecomeMemberModal;
