import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Field, FieldGroup } from "./ui/field";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import ImageUpload from "./ImageUpload";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store/store";
import { storeUser } from "../reducers/userReducer";
const formSchema = z.object({
  title: z.string().min(1, "Title is required!"),
  bio: z.string().min(1, "Bio is required"),
  img: z.instanceof(File, { message: "Image is required!" }),
});

const BecomeMemberModal = ({
  open,
  handleOpen,
}: {
  open: boolean;
  handleOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  function handleSubmit(data: { title: string; bio: string; img: File }) {
    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("bio", data.bio);
    formData.append("image", data.img);

    fetch("http://localhost:3000/artist/createArtist", {
      method: "POST",
      body: formData,
      credentials: "include",
    })
      .then((data) => data.json())
      .then((data) => {
        dispatch(storeUser(data.user));
        handleOpen(false);
      });
  }
  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="rounded-none bg-[#121212] text-gray-300 border-none">
        <DialogHeader>
          <DialogTitle>Become an Artist</DialogTitle>
          <DialogDescription>
            Register here to become an artist!
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            <Controller
              name="title"
              control={form.control}
              render={({ field }) => {
                return (
                  <Field>
                    <Label htmlFor="name">Artist Name</Label>
                    <Input
                      className="rounded-none"
                      {...field}
                      id="name"
                      name="name"
                      placeholder="Pedro Duarte"
                    />
                  </Field>
                );
              }}
            />
            <Controller
              name="bio"
              control={form.control}
              render={({ field }) => {
                return (
                  <Field>
                    <Label htmlFor="bio">Bio</Label>
                    <Input
                      className="rounded-none"
                      {...field}
                      id="bio"
                      name="bio"
                      placeholder="I make pop music"
                    />
                  </Field>
                );
              }}
            />
            <Controller
              name="img"
              control={form.control}
              render={({ field }) => {
                return <ImageUpload field={field} />;
              }}
            />
          </FieldGroup>
          <Button>Create</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BecomeMemberModal;
