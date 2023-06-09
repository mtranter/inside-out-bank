import {
  AspectRatio,
  Box,
  Button,
  Image,
  Skeleton,
  Stack,
  StackProps,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { PriceTag } from "./price-tag";
import { z } from "zod";
import { DeleteButton } from "./delete-button";
import { useState } from "react";

export const ProductSchema = z.object({
  sku: z.string(),
  name: z.string(),
  description: z.string(),
  shortDescription: z.string(),
  rrp: z.number(),
  categoryId: z.string(),
  category: z.string(),
  subCategory: z.string(),
});

export type ProductDetails = z.infer<typeof ProductSchema>;

type Props = {
  product: ProductDetails;
  rootProps?: StackProps;
  onDelete: () => void;
};

export const ProductCard = (props: Props) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { product, rootProps } = props;
  const { name, rrp, description, shortDescription } = product;
  const imageUrl = `/images/products/${product.categoryId}/${product.subCategory
    .replaceAll(" ", "")
    .toLowerCase()}_300.png`;
  const updatedHandler =
    (property: keyof ProductDetails) =>
    (event: React.FocusEvent<HTMLParagraphElement>) => {
      product[property] = event.currentTarget.innerText as never;
    };


  return (
    <Stack
      rounded={"10"}
      boxShadow="md"
      backgroundColor={"whiteAlpha.800"}
      padding={5}
      spacing={{ base: "4", md: "5" }}
      {...rootProps}
    >
      <Box position="relative">
        <AspectRatio ratio={4 / 3}>
          <Image
            src={imageUrl}
            alt={name}
            draggable="false"
            fallback={<Skeleton />}
            borderRadius={{ base: "md", md: "xl" }}
          />
        </AspectRatio>
        <DeleteButton
          position="absolute"
          top="4"
          right="4"
          aria-label={`Add ${name} to your favourites`}
          onClick={() => setShowDeleteConfirm(true)}
        />
      </Box>
      <Stack position={"relative"}>
        <Stack
          justifyContent="center"
          spacing="5"
          position={"absolute"}
          height={"100%"}
          width={"100%"}
          visibility={showDeleteConfirm ? "visible" : "hidden"}
        >
          <Button bgColor={"brand.500"} color="white" onClick={() => props.onDelete()}>Delete</Button>
          <Button onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>

        </Stack>
        <Stack spacing="1" visibility={showDeleteConfirm ? "hidden" : "visible"}>
          <Text
            // contentEditable={true}
            // suppressContentEditableWarning={true}
            onBlur={updatedHandler("name")}
            fontSize="lg"
            fontWeight="semibold"
            color={useColorModeValue("gray.700", "gray.400")}
          >
            {name}
          </Text>
          <Text
            // suppressContentEditableWarning={true}
            // contentEditable={true}
            onBlur={updatedHandler("shortDescription")}
            fontWeight="medium"
            color={useColorModeValue("gray.600", "gray.200")}
          >
            {shortDescription}
          </Text>
          <hr />
          <Text
            marginTop={1}
            // contentEditable={true}
            // suppressContentEditableWarning={true}
            onBlur={updatedHandler("description")}
            fontWeight="medium"
            color={useColorModeValue("gray.700", "gray.400")}
          >
            {description}
          </Text>
          <PriceTag price={rrp} currency="USD" />
        </Stack>
        {/* <HStack>
          <Text fontSize="sm" color={useColorModeValue("gray.600", "gray.400")}>
            12 Reviews
          </Text>
        </HStack> */}
      </Stack>
      {/* <Stack align="center">
        <Button colorScheme="blue" width="full">
          Add to cart
        </Button>
        <Link
          textDecoration="underline"
          fontWeight="medium"
          color={useColorModeValue("gray.600", "gray.400")}
        >
          Quick shop
        </Link>
      </Stack> */}
    </Stack>
  );
};
