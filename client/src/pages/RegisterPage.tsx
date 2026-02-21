import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import type { AppDispatch } from "../store/store";
import { storeUser } from "../reducers/userReducer";

interface FormInfoType {
  email: {
    value: string;
    error: string;
  };
  password: {
    value: string;
    error: string;
  };
}

const RegisterPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [formInfo, setFormInfo] = useState<FormInfoType>({
    email: { value: "", error: "" },
    password: { value: "", error: "" },
  });
  useEffect(() => {
    async function checkAuth() {
      const data = await fetch("http://localhost:3000/checkAuth", {
        method: "GET",
        credentials: "include",
      });
      const json = await data.json();
      if (json.authenticated) {
        navigate("/");
      }
    }
    checkAuth();
  }, []);
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = formInfo.email.value;
    const password = formInfo.password.value;
    fetch("http://localhost:3000/register", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ email, password }),
      headers: {
        "Content-type": "application/json",
      },
    });
    dispatch(storeUser({ email }));
    navigate("/");
  }

  return (
    <div className="bg-linear-to-b from-[#121212] to-[#171717] w-screen h-screen text-white flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="bg-linear-to-b from-red-600 to-[#160000] p-10 rounded-md min-w-90"
      >
        <div className="my-2 flex flex-col">
          <label className="text-sm" htmlFor="email">
            Email
          </label>
          <input
            className="bg-white p-2 rounded-sm text-black text-sm"
            type="text"
            id="email"
            name="email"
            value={formInfo.email.value}
            onChange={(e) => {
              setFormInfo({
                ...formInfo,
                email: { ...formInfo.email, value: e.target.value },
              });
            }}
          />
        </div>
        <div className="my-2 flex flex-col">
          <label className="text-sm" htmlFor="password">
            Password
          </label>
          <input
            className="bg-white p-2 rounded-sm text-black text-sm"
            type="password"
            id="password"
            name="password"
            value={formInfo.password.value}
            onChange={(e) => {
              setFormInfo({
                ...formInfo,
                password: { ...formInfo.password, value: e.target.value },
              });
            }}
          />
        </div>
        <div className="w-full flex justify-center">
          <button className="bg-[#121212] text-sm px-5 rounded-sm py-1">
            Register
          </button>
        </div>
        <div className="text-center">
          <Link className="text-[0.8rem] text-center" to="/login">
            Already Registered, Click to Login!
          </Link>
        </div>
      </form>
    </div>
  );
};

export default RegisterPage;
