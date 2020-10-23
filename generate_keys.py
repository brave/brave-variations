import base64
import ecdsa
import time


def generate_keys():
    sk = ecdsa.SigningKey.generate(curve=ecdsa.SECP256k1)
    vk = sk.get_verifying_key()

    private_key = sk.to_string().hex()
    public_key = vk.to_string().hex()

    return private_key, public_key


def sign_seed(private_key, message):
    sk = ecdsa.SigningKey.from_string(bytes.fromhex(private_key), curve=ecdsa.SECP256k1)
    base64_signature = base64.b64encode(sk.sign(message))

    return base64_signature, message


if __name__ == "__main__":
    private_key, public_key = generate_keys()

    print("private_key:", private_key)
    print("public_key:", public_key)

    with open("./seed", "rb") as file:
        bfile = file.read()
        base64_signature, message = sign_seed(private_key, bfile)

    base64_public_key = base64.b64encode(bytes.fromhex(public_key))

    print("base64_public_key:", base64_public_key)
    print("base64_signature:", base64_signature)
    print("message:", message)
