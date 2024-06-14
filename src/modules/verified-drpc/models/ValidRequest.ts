import { type ValidationOptions, ValidateBy, ValidationError, buildMessage } from 'class-validator'

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
            let isValid = false
            if (!Array.isArray(value)) {
              isValid = isValidVerifiedDrpcRequest(value)
            } else {
              isValid = value.every(isValidVerifiedDrpcRequest)
            }

            if (!isValid) {
              throw new ValidationError()
            }

            return isValid
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
  return 'jsonrpc' in value && 'method' in value && 'id' in value
}
