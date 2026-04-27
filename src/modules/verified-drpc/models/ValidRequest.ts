import { type ValidationOptions, ValidateBy, buildMessage } from 'class-validator'

export function IsValidVerifiedDrpcRequest(validationOptions?: ValidationOptions): PropertyDecorator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey: string | symbol) {
    ValidateBy(
      {
        name: 'isValidVerifiedDrpcRequest',
        validator: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          validate: (value: any): boolean => {
            // Check if value is a VerifiedDrpcRequestObject or an array of VerifiedDrpcRequestObject
            if (Array.isArray(value)) {
              if (!value.every(isValidVerifiedDrpcRequest)) {
                return false
              }

              return true
            }

            if (!isValidVerifiedDrpcRequest(value)) {
              return false
            }

            return true
          },
          defaultMessage: buildMessage(
            (eachPrefix) => eachPrefix + '$property is not a valid VerifiedDrpcRequest',
            validationOptions
          ),
        },
      },
      validationOptions
    )(target, propertyKey)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValidVerifiedDrpcRequest(value: any): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return value.jsonrpc === '2.0' && 'method' in value && 'id' in value
}
