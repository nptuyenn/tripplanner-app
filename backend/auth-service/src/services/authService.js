import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

function publicUser(user) {
  return {
    id: user.id ?? user._id?.toString(),
    name: user.name,
    email: user.email,
  };
}

export function createAuthService(User, { jwtPrivateKey, jwtExpiresIn, jwtKeyId }) {
  function issueToken(user) {
    return jwt.sign({ sub: user.id ?? user._id.toString() }, jwtPrivateKey, {
      algorithm: "RS256",
      expiresIn: jwtExpiresIn,
      ...(jwtKeyId ? { keyid: jwtKeyId } : {}),
    });
  }

  return {
    async register({ name, email, password }) {
      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await User.findOne({ email: normalizedEmail });

      if (existingUser) {
        const error = new Error("An account with this email already exists");
        error.statusCode = 409;
        throw error;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: passwordHash,
      });

      return {
        token: issueToken(user),
        user: publicUser(user),
      };
    },

    async login({ email, password }) {
      const normalizedEmail = email.trim().toLowerCase();
      const user = await User.findOne({ email: normalizedEmail }).select("+password");
      const validPassword = user && (await bcrypt.compare(password, user.password));

      if (!validPassword) {
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        throw error;
      }

      return {
        token: issueToken(user),
        user: publicUser(user),
      };
    },
  };
}
