import { Icon, IconButton, IconButtonProps, LightMode } from '@chakra-ui/react'
import { BsTrash } from 'react-icons/bs'

type Props = IconButtonProps & {
  onClick: () => void  
}

export const DeleteButton = (props: Props) => (
  <LightMode>
    <IconButton
      isRound
      bg="white"
      color="gray.900"
      size="sm"
      _hover={{ transform: 'scale(1.1)' }}
      sx={{ ':hover > svg': { transform: 'scale(1.1)' } }}
      transition="all 0.15s ease"
      icon={<Icon as={BsTrash} transition="all 0.15s ease" />}
      boxShadow="base"
      {...props}
    />
  </LightMode>
)