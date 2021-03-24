package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
)

// GenerateKeyPair creates both the private key to sign the seed file, as well
// as the public key as used for `kPublicKey` in `variations_seed_store.cc`.
func GenerateKeyPair() error {
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return err
	}

	privateKeyBytes, err := x509.MarshalECPrivateKey(privateKey)
	if err != nil {
		return err
	}

	privateKeyPem := pem.EncodeToMemory(
		&pem.Block{
			Type:  "ECDSA PRIVATE KEY",
			Bytes: privateKeyBytes,
		},
	)

	fmt.Printf("%s\n", string(privateKeyPem))

	err = ioutil.WriteFile("./privatekey.pem", []byte(privateKeyPem), 0644)
	if err != nil {
		return err
	}

	publicKey := &privateKey.PublicKey
	publicKeyDer, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		return err
	}

	fmt.Printf("public key: % x\n", publicKeyDer)
	return nil
}

// SignSeedData loads the seed file as created by `serialize_variations_seed.py`
// and creates a base64 encoded signature over the sha256 digest, which will be
// sent with the `X-Seed-Signature` header.
// Uses the private key in `./privatekey`. If no private key exists one can be
// generated via `go run ./crypto.go keygen`
func SignSeedData() error {
	privateKeyPem, err := ioutil.ReadFile("./privatekey.pem")
	if err != nil {
		return err
	}

	privateKeyBlock, _ := pem.Decode([]byte(privateKeyPem))
	if privateKeyBlock == nil {
		return errors.New("Error decoding PEM file")
	}

	privateKey, err := x509.ParseECPrivateKey(privateKeyBlock.Bytes)
	if err != nil {
		return err
	}

	seedData, err := ioutil.ReadFile("./seed.bin")
	if err != nil {
		return err
	}

	digest := sha256.Sum256([]byte(seedData))

	signature, err := ecdsa.SignASN1(rand.Reader, privateKey, digest[:])
	if err != nil {
		return err
	}

	signature64 := base64.StdEncoding.EncodeToString(signature)

	fmt.Printf("%s\n", signature64)
	return nil
}

func main() {
	usageInfo := "Usage: go run ./crypto.go [keygen|sign]"
	args := os.Args[1:]
	if len(args) == 0 {
		println(usageInfo)
		os.Exit(0)
	}

	cmd := args[0]
	var err error
	if cmd == "keygen" {
		err = GenerateKeyPair()
	} else if cmd == "sign" {
		err = SignSeedData()
	} else {
		println(usageInfo)
		os.Exit(0)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}
}
