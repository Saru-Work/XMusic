import { useState } from "react";
import { Field } from "./ui/field";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import type { ControllerRenderProps } from "react-hook-form";
import { Music, Pencil } from "lucide-react";

const ImageUpload = ({
  field,
}: {
  field:
    | ControllerRenderProps<
        {
          title: string;
          bio: string;
          img: File;
        },
        "img"
      >
    | ControllerRenderProps<
        { title: string; description: string; img: File },
        "img"
      >;
}) => {
  const [imgFile, setImgFile] = useState<File | null>();
  const [hoveredPen, setHoveredPen] = useState(false);
  return (
    <Field className="max-w-38">
      <label
        htmlFor="image"
        className="w-38 h-38 max-w-38 flex items-center justify-center border border-gray-300 cursor-pointer"
        onMouseEnter={() => {
          setHoveredPen(true);
        }}
        onMouseLeave={() => {
          setHoveredPen(false);
        }}
      >
        {imgFile ? (
          <img
            className="w-38 h-38 object-cover"
            src={URL.createObjectURL(imgFile)}
          />
        ) : !hoveredPen ? (
          <Music />
        ) : (
          <Pencil />
        )}
      </label>
      <Input
        className="rounded-none invisible h-0 max-w-0"
        id="image"
        type="file"
        name={field.name}
        onBlur={field.onBlur}
        disabled={field.disabled}
        ref={field.ref}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            setImgFile(e.target.files[0]);
            field.onChange(e.target.files[0]);
          }
        }}
      />
      <div>
        {imgFile && (
          <img className="max-h-50" src={URL.createObjectURL(imgFile)} />
        )}
      </div>
    </Field>
  );
};

export default ImageUpload;
